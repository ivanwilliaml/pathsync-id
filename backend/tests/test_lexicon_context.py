"""Context rules added after the dev-half error analysis (18 Oct 2026): a word that names a skill only in some contexts."""
import pytest

from pathsync.extraction import extract_skills


def skills(text: str) -> set[str]:
    return set(extract_skills(text, prefer="lexicon").skills)


@pytest.mark.parametrize("text, absent", [
    ("- Mastery of Express.js / Node.js for API development and payment integration.", "javascript"),
    ("- Act as the thought partner to the GTM team to shape the market strategy.", "web_analytics"),
    ("- Knowledge of stream processing frameworks such as Apache Flink or Apache Kafka.", "web_servers_proxies"),
    ("- Strong knowledge of the Go programming language with 3 years of experience.", "python_analytics"),
    ("- Estimate story points and contribute to team capacity planning.", "production_planning_mrp"),
    ("- Pendidikan minimal S1 semua jurusan (Matematika/Statistika lebih disukai).", "statistics"),
    ("Yuk join bareng PT Contoh Global Marketplace!", "marketplace_ecommerce"),
    ("- In this role you will combine CRM analytics, machine learning and experimentation.", "ios_swift"),
])
def test_word_outside_its_skill_context_is_not_a_mention(text, absent):
    assert absent not in skills(text)


@pytest.mark.parametrize("text, present", [
    ("- Experience with JavaScript and TypeScript for web applications.", "javascript"),
    ("- Set up tracking with Google Tag Manager (GTM) and GA4.", "web_analytics"),
    ("- Configure Nginx or Apache as a reverse proxy for our services.", "web_servers_proxies"),
    ("- Build iOS apps with Swift, SwiftUI and Combine.", "ios_swift"),
])
def test_same_word_in_its_skill_context_is_still_found(text, present):
    assert present in skills(text)
