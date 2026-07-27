/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const progress = document.querySelector(".scroll-progress span");
const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const revealElements = [...document.querySelectorAll(".reveal")];

function updateProgress() {
  if (!progress) return;
  const available = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = available > 0 ? Math.min(window.scrollY / available, 1) : 0;
  progress.style.transform = `scaleX(${ratio})`;
}

document.documentElement.classList.add("motion-ready");
updateProgress();
window.addEventListener("scroll", updateProgress, { passive: true });

if (reduceMotion) {
  for (const element of revealElements) element.classList.add("is-visible");
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12 }
  );
  for (const element of revealElements) revealObserver.observe(element);
}

const observedSections = sectionLinks
  .map((link) => document.getElementById(link.dataset.sectionLink))
  .filter(Boolean);

const navigationObserver = new IntersectionObserver(
  (entries) => {
    const current = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!current) return;
    for (const link of sectionLinks) {
      const active = link.dataset.sectionLink === current.target.id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  },
  { rootMargin: "-25% 0px -55%", threshold: [0.05, 0.25, 0.5] }
);

for (const section of observedSections) navigationObserver.observe(section);
