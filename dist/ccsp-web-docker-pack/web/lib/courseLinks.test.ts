import { describe, it, expect } from "vitest";
import { courseDetailHref } from "./courseLinks";

describe("courseDetailHref", () => {
  it("produces the correct URL for normal course code", () => {
    expect(courseDetailHref({ year: 114, semester: 2, courseCode: "1249" }))
      .toBe("/courses/114/2/1249");
  });

  it("produces the correct URL for alphabetic course code", () => {
    expect(courseDetailHref({ year: 114, semester: 1, courseCode: "ABCD" }))
      .toBe("/courses/114/1/ABCD");
  });

  it("encodes special characters in courseCode", () => {
    const href = courseDetailHref({ year: 114, semester: 2, courseCode: "A/B C" });
    expect(href).toBe("/courses/114/2/A%2FB%20C");
  });

  it("includes year and semester, not hardcoded", () => {
    const href = courseDetailHref({ year: 113, semester: 1, courseCode: "9999" });
    expect(href).toContain("/113/1/");
    expect(href).not.toContain("/114/");
  });
});
