"""Expert-ranking study: scenarios, simulated feasibility check, training and evaluation.

1. builds ~45 scenarios (15 base x {base, competency changed, market changed}) from the
   live Business Analyst market map and stores them for the real expert panel;
2. runs the paper's feasibility simulation (III.A.4): three simulated experts with three
   possible judging styles, grouped CV, bootstrap CIs, ablation, adaptivity, data-size check;
3. trains the ranking model and registers it - it becomes active only if it agrees with the
   reference at least as well as formula (5) (paper III.D.4 risk mitigation).

Run: python -m pipeline.expert_study
"""
from __future__ import annotations

import json
from datetime import datetime

import numpy as np
from sqlalchemy import delete, select, update

from pathsync.config import FEATURES, MODELS_DIR
from pathsync.db import Expert, RankerModel, Scenario, ScenarioRanking, get_session, init_db
from pathsync.engine import load_context
from pathsync.evaluation import NON_INFERIORITY, adaptivity, cross_validate, passes_rule, train_full
from pathsync.extraction.llm import LLMUnavailable, llm_configured
from pathsync.ranker import aggregate_orders, kendalls_w
from pathsync.scenarios import build_scenarios, simulate_expert

CONDITIONS = {
    "titik_hambat": ["titik_hambat"] * 3,
    "kesenjangan_permintaan": ["kesenjangan_permintaan"] * 3,
    "campuran": ["titik_hambat", "kesenjangan_permintaan", "kesiapan"],
}


def simulate(scenarios, styles, seed):
    rng = np.random.default_rng(seed)
    per_expert = {f"sim{i + 1}": {s["id"]: simulate_expert(s, st, rng) for s in scenarios} for i, st in enumerate(styles)}
    refs, ws = {}, []
    for s in scenarios:
        orders = [per_expert[e][s["id"]] for e in per_expert]
        refs[s["id"]] = aggregate_orders(orders)
        ws.append(kendalls_w(orders))
    return per_expert, refs, float(np.mean(ws))


def llm_orders(scenarios, names) -> dict[str, list[str]] | None:
    if not llm_configured():
        return None
    from pathsync.extraction import llm_extractor

    out = {}
    try:
        for s in scenarios:
            lines = [f"Peran target: Business Analyst. Profil: {s['title']}.", "Kandidat keterampilan:"]
            for c in s["candidates"]:
                st = s["student"][c]
                lines.append(f"- {c} ({names[c]}): penguasaan {st['p']:.2f}, dibutuhkan {st['r']:.2f}, "
                             f"muncul di {s['market'][c]['D']:.0%} lowongan")
            out[s["id"]] = llm_extractor().generic_ranking("\n".join(lines), s["candidates"])
    except LLMUnavailable:
        return None
    return out


def main():
    init_db()
    report = {"generated_at": datetime.now().isoformat(timespec="seconds"), "role": "business_analyst",
              "note": "Simulasi kelayakan dengan pakar tersimulasi (bukan kinerja pada pakar nyata). "
                      "Peringkat pakar nyata dikumpulkan melalui Panel Pakar dan dilatih dengan pipeline yang sama.",
              "conditions": {}}
    with get_session() as s:
        ctx = load_context(s, "business_analyst")
        scenarios = build_scenarios(ctx.graph, ctx.market, ctx.req, n_base=15, seed=7)
        report["n_scenarios"] = len(scenarios)
        report["n_base"] = len({x["base_id"] for x in scenarios})
        report["market_version"] = ctx.market_version

        # store scenarios for the real expert panel (generated ones are replaced, rankings kept by id)
        existing = {x.id for x in s.scalars(select(Scenario)).all()}
        for sc in scenarios:
            row = s.get(Scenario, sc["id"]) if sc["id"] in existing else None
            if row is None:
                s.add(Scenario(id=sc["id"], base_id=sc["base_id"], variant=sc["variant"], title=sc["title"],
                               role="business_analyst", payload=sc))
            else:
                row.payload, row.title = sc, sc["title"]
        s.flush()
        for i, (name, kind) in enumerate([("Pakar simulasi 1", "simulasi"), ("Pakar simulasi 2", "simulasi"),
                                          ("Pakar simulasi 3", "simulasi")]):
            if s.get(Expert, f"sim{i + 1}") is None:
                s.add(Expert(id=f"sim{i + 1}", name=name, affiliation="simulasi kelayakan", kind=kind, validates_graph=False))
        s.flush()

        llm = llm_orders(scenarios, ctx.names)
        report["llm_baseline"] = "dijalankan" if llm else "tidak dijalankan (butuh kredensial Anthropic API)"
        final = None
        for cond, styles in CONDITIONS.items():
            per_expert, refs, mean_w = simulate(scenarios, styles, seed=11)
            cv = cross_validate(scenarios, refs, k=5, extra_orders={"llm_umum": llm} if llm else None)
            abl_graph = cross_validate(scenarios, refs, k=5, features=[f for f in FEATURES if f not in ("U", "B", "R")])
            abl_trend = cross_validate(scenarios, refs, k=5, features=[f for f in FEATURES if f != "T"])
            w_full, lam_full = train_full(scenarios, refs)
            entry = {
                "styles": styles, "kendall_w_mean": round(mean_w, 4), "cv": cv,
                "ablation": {"tanpa_fitur_graf": abl_graph["methods"]["model"]["ndcg5"],
                             "tanpa_fitur_tren": abl_trend["methods"]["model"]["ndcg5"],
                             "lengkap": cv["methods"]["model"]["ndcg5"]},
                "weights_full": w_full, "l2_full": lam_full, "adaptivity": adaptivity(scenarios, refs, w_full),
            }
            # data-size sensitivity (paper: 8 vs 30 base scenarios differ by at most 0.02)
            sizes = {}
            for nb in (8, 15, 30):
                sc_n = build_scenarios(ctx.graph, ctx.market, ctx.req, n_base=nb, seed=100 + nb)
                _, refs_n, _ = simulate(sc_n, styles, seed=11)
                sizes[str(nb)] = cross_validate(sc_n, refs_n, k=min(5, nb))["methods"]["model"]["ndcg5"]["mean"]
            entry["ndcg5_by_n_base"] = sizes
            report["conditions"][cond] = entry
            print(f"[{cond}] W={mean_w:.3f} NDCG@5 model={cv['methods']['model']['ndcg5']['mean']:.3f} "
                  f"f5={cv['methods']['formula5']['ndcg5']['mean']:.3f} "
                  f"gap={cv['methods']['kesenjangan_terbesar']['ndcg5']['mean']:.3f} "
                  f"gapxD={cv['methods']['kesenjangan_x_permintaan']['ndcg5']['mean']:.3f} | sizes {sizes}")
            if cond == "campuran":
                final = (per_expert, refs, w_full, cv)

        # persist simulated rankings of the mixed condition (kept apart from real experts by `simulated`)
        per_expert, refs, w_full, cv = final
        s.execute(delete(ScenarioRanking).where(ScenarioRanking.simulated.is_(True)))
        for eid, orders in per_expert.items():
            for sid, order in orders.items():
                s.add(ScenarioRanking(scenario_id=sid, expert_id=eid, order=order, simulated=True))
        model_ndcg = cv["methods"]["model"]["ndcg5"]["mean"]
        f5_ndcg = cv["methods"]["formula5"]["ndcg5"]["mean"]
        activate = passes_rule(cv)
        if activate:
            s.execute(update(RankerModel).values(active=False))
        s.add(RankerModel(name="LTR v1 (dilatih pada simulasi pakar)", source="simulated", weights=w_full,
                          metrics={"cv_ndcg5": cv["methods"]["model"]["ndcg5"], "cv_formula5_ndcg5": cv["methods"]["formula5"]["ndcg5"],
                                   "condition": "campuran", "rule": f"aktif bila NDCG@5 >= formula (5) - {NON_INFERIORITY}"},
                          active=activate))
        s.commit()
        report["registered_model"] = {"weights": w_full, "active": activate, "cv_ndcg5": model_ndcg, "formula5_ndcg5": f5_ndcg}

    (MODELS_DIR / "evaluation_report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report["registered_model"], indent=1))


if __name__ == "__main__":
    main()
