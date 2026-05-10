import { describe, expect, it } from "vitest";
import { getCourseDisplayName } from "./courseDisplay";

describe("getCourseDisplayName — basic", () => {
  it("returns normal course names unchanged", () => {
    expect(getCourseDisplayName("企業概論")).toBe("企業概論");
    expect(getCourseDisplayName("行銷管理")).toBe("行銷管理");
    expect(getCourseDisplayName("英文寫作")).toBe("英文寫作");
  });

  it("handles empty string without crashing", () => {
    expect(getCourseDisplayName("")).toBe("");
  });
});

describe("getCourseDisplayName — short parenthesis (keep)", () => {
  it("keeps short bracket that looks like part of the name", () => {
    expect(getCourseDisplayName("行銷管理(二)")).toBe("行銷管理(二)");
    expect(getCourseDisplayName("英文(一)")).toBe("英文(一)");
    expect(getCourseDisplayName("微積分(下)")).toBe("微積分(下)");
  });

  it("keeps bracket even with a course-title word if short", () => {
    expect(getCourseDisplayName("管理學(進階)")).toBe("管理學(進階)");
  });
});

describe("getCourseDisplayName — mojibake truncation", () => {
  const FFFD = "\uFFFD";

  it("truncates at the preceding ( when mojibake is inside bracket", () => {
    const input = `企業政策(${FFFD}企業概論、管理學、行銷管理。不開放網路選課。)`;
    expect(getCourseDisplayName(input)).toBe("企業政策");
  });

  it("truncates directly at mojibake when no preceding ( ", () => {
    const input = `課程名稱${FFFD}以下為亂碼`;
    expect(getCourseDisplayName(input)).toBe("課程名稱");
  });

  it("handles name that is entirely mojibake", () => {
    const input = `${FFFD}`;
    expect(getCourseDisplayName(input)).toBe("");
  });
});

describe("getCourseDisplayName — long restriction bracket", () => {
  it("strips long restriction bracket containing 不開放", () => {
    const name = "商事法(不開放網路選課，本課程為必修課)";
    expect(getCourseDisplayName(name)).toBe("商事法");
  });

  it("strips long restriction bracket containing 先修", () => {
    const name = "進階管理學(先修：管理學、行銷管理，限修2年級以上)";
    expect(getCourseDisplayName(name)).toBe("進階管理學");
  });

  it("strips long bracket containing 限修 keyword", () => {
    const name = "數理統計(限修統計系三年級以上學生，不得重複修習)";
    expect(getCourseDisplayName(name)).toBe("數理統計");
  });

  it("does NOT strip a bracket exactly at the 12-char boundary (must be >12)", () => {
    // 12 chars exactly: should NOT be stripped
    const inner12 = "A".repeat(12);
    const name = `課名(${inner12})`;
    // inner12 has no restriction keyword, so stays anyway
    expect(getCourseDisplayName(name)).toBe(name);
  });

  it("does NOT strip bracket without restriction keywords even if long", () => {
    const name = "人文通識：西方哲學與文化傳統（第一講至第十四講，含期末報告）";
    expect(getCourseDisplayName(name)).toBe(name);
  });
});
