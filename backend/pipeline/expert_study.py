"""Expert-ranking study: scenarios, simulated feasibility check, training and evaluation.

1. builds ~45 scenarios (15 base x {base, competency changed, market changed}) from the
   live Business Analyst market map and stores them for the real expert panel;
2. runs the paper's feasibility simulation (III.A.4): three simulated experts with three
   possible judging styles, grouped CV, bootstrap CIs, ablation, adaptivity, data-size check;
3. trains the ranking model and registers it - it becomes active only if it agrees with the
   reference at least as well as formula (5) (paper III.D.4 risk mitigation).

Run: python -m pipeline.expert_study [--role ROLE | --all-roles]

Business Analyst (the default) also registers the ranker used by the app. Other roles store their
own scenarios for the expert panel and write data/models/evaluation_report_<role>.json only
(plan A4: experts rank per role family; the decision model is per family once real rankings exist).
"""
from __future__ import annotations

import json
from datetime import datetime

import numpy as np
from sqlalchemy import delete, select, update

from pathsync.config import FEATURES, MODELS_DIR
from pathsync.db import Expert, RankerModel, Scenario, ScenarioRanking, bump_epoch, get_session, init_db
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


def scenario_prompt(s: dict, names: dict[str, str], role_name: str = "Business Analyst") -> str:
    """The text a generic LLM sees for one scenario (baseline 4: no taxonomy weights, no graph)."""
    lines = [f"Peran target: {role_name}. Profil: {s['title']}.", "Kandidat keterampilan:"]
    for c in s["candidates"]:
        st = s["student"][c]
        lines.append(f"- {c} ({names[c]}): penguasaan {st['p']:.2f}, dibutuhkan {st['r']:.2f}, "
                     f"muncul di {s['market'][c]['D']:.0%} lowongan")
    return "\n".join(lines)


def llm_orders(scenarios, names, role_name: str = "Business Analyst") -> tuple[dict[str, list[str]] | None, str]:
    """Generic-LLM orders: live from Claude when configured, else imported from an offline GPU run."""
    if llm_configured():
        from pathsync.extraction import llm_extractor

        try:
            return {s["id"]: llm_extractor().generic_ranking(scenario_prompt(s, names, role_name), s["candidates"])
                    for s in scenarios}, "dijalankan (Claude)"
        except LLMUnavailable:
            pass
    from pipeline.llm_jobs import LLM_ORDERS, _scenario_fingerprint

    if LLM_ORDERS.exists():
        data = json.loads(LLM_ORDERS.read_text(encoding="utf-8"))
        orders, fps = data["orders"], data.get("fingerprints", {})
        if all(s["id"] in orders and fps.get(s["id"]) == _scenario_fingerprint(s) for s in scenarios):
            return {s["id"]: orders[s["id"]] for s in scenarios}, f"dijalankan ({data.get('model')}, luring)"
        return None, "tidak dijalankan (urutan LLM luring tidak lengkap/kedaluwarsa; ekspor ulang skenario)"
    return None, "tidak dijalankan (butuh kredensial Anthropic API atau hasil LLM luring)"


def main(role: str = "business_analyst"):
    init_db()
    primary = role == "business_analyst"
    prefix = "" if primary else f"{role}:"
    report = {"generated_at": datetime.now().isoformat(timespec="seconds"), "role": role,
              "note": "Simulasi kelayakan dengan pakar tersimulasi (bukan kinerja pada pakar nyata). "
                      "Peringkat pakar nyata dikumpulkan melalui Panel Pakar dan dilatih dengan pipeline yang sama.",
              "conditions": {}}
    with get_session() as s:
        ctx = load_context(s, role)
        scenarios = build_scenarios(ctx.graph, ctx.market, ctx.req, n_base=15, seed=7, role=role, id_prefix=prefix)
        report["n_scenarios"] = len(scenarios)
        report["n_base"] = len({x["base_id"] for x in scenarios})
        report["market_version"] = ctx.market_version

        # store scenarios for the real expert panel (generated ones are replaced, rankings kept by id)
        existing = {x.id for x in s.scalars(select(Scenario)).all()}
        for sc in scenarios:
            row = s.get(Scenario, sc["id"]) if sc["id"] in existing else None
            if row is None:
                s.add(Scenario(id=sc["id"], base_id=sc["base_id"], variant=sc["variant"], title=sc["title"],
                               role=role, payload=sc))
            else:
                row.payload, row.title = sc, sc["title"]
        s.flush()
        for i, (name, kind) in enumerate([("Pakar simulasi 1", "simulasi"), ("Pakar simulasi 2", "simulasi"),
                                          ("Pakar simulasi 3", "simulasi")]):
            if s.get(Expert, f"sim{i + 1}") is None:
                s.add(Expert(id=f"sim{i + 1}", name=name, affiliation="simulasi kelayakan", kind=kind, validates_graph=False))
        s.flush()

        llm, report["llm_baseline"] = llm_orders(scenarios, ctx.names, ctx.role_name)
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
                sc_n = build_scenarios(ctx.graph, ctx.market, ctx.req, n_base=nb, seed=100 + nb, role=role, id_prefix=prefix)
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
        if not primary:
            s.commit()
            report["registered_model"] = {"weights": w_full, "active": False, "note": "report only; the app ranker is "
                                          "trained on Business Analyst rankings", "cv_ndcg5": cv["methods"]["model"]["ndcg5"]["mean"],
                                          "formula5_ndcg5": cv["methods"]["formula5"]["ndcg5"]["mean"]}
            out = MODELS_DIR / f"evaluation_report_{role}.json"
            out.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
            print(json.dumps(report["registered_model"], indent=1))
            return report
        ids = [x["id"] for x in scenarios]
        s.execute(delete(ScenarioRanking).where(ScenarioRanking.simulated.is_(True), ScenarioRanking.scenario_id.in_(ids)))
        for eid, orders in per_expert.items():
            for sid, order in orders.items():
                s.add(ScenarioRanking(scenario_id=sid, expert_id=eid, order=order, simulated=True))
        model_ndcg = cv["methods"]["model"]["ndcg5"]["mean"]
        f5_ndcg = cv["methods"]["formula5"]["ndcg5"]["mean"]
        activate = passes_rule(cv)
        if activate:
            s.execute(update(RankerModel).values(active=False))
        # replace the previous simulated model instead of piling up one per run
        s.execute(delete(RankerModel).where(RankerModel.source == "simulated", RankerModel.name.like("LTR v1%")))
        bump_epoch(s)
        s.add(RankerModel(name="LTR v1 (trained on simulated experts)", source="simulated", weights=w_full,
                          metrics={"cv_ndcg5": cv["methods"]["model"]["ndcg5"], "cv_formula5_ndcg5": cv["methods"]["formula5"]["ndcg5"],
                                   "condition": "campuran", "rule": f"aktif bila NDCG@5 >= formula (5) - {NON_INFERIORITY}"},
                          active=activate))
        s.commit()
        report["registered_model"] = {"weights": w_full, "active": activate, "cv_ndcg5": model_ndcg, "formula5_ndcg5": f5_ndcg}

    (MODELS_DIR / "evaluation_report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report["registered_model"], indent=1))
    return report


if __name__ == "__main__":
    import argparse

    from pathsync.config import ROLES

    ap = argparse.ArgumentParser()
    ap.add_argument("--role", default="business_analyst", choices=sorted(ROLES))
    ap.add_argument("--all-roles", action="store_true", help="every role; Business Analyst last so its model stays active")
    a = ap.parse_args()
    for r in ([x for x in ROLES if x != "business_analyst"] + ["business_analyst"]) if a.all_roles else [a.role]:
        main(r)
