import { describe, expect, it } from "vitest";
import { phase3RouteDefinitions } from "./routes";

describe("Phase 3 route manifest", () => {
  it("keeps every path and label unique", () => {
    const paths = phase3RouteDefinitions.map((route) => route.path);
    const labels = phase3RouteDefinitions.map((route) => route.label);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("keeps provider-heavy surfaces in their own lazy routes", () => {
    expect(phase3RouteDefinitions.filter((route) => ["/ocr", "/asistente", "/mapas"].includes(route.path))).toHaveLength(3);
    expect(phase3RouteDefinitions.every((route) => typeof route.load === "function")).toBe(true);
  });
});
