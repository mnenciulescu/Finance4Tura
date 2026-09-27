import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  Card, StatTile, Pill, Checkbox, ProgressBar, Button, Input, Sheet, SectionHeader,
} from "./ui";

/** The inline style React actually applied, as a plain object. */
const styleOf = (el) => el.style;

describe("Card", () => {
  it("carries elevation instead of a stroke", () => {
    const { container } = render(<Card>body</Card>);
    const el = container.firstChild;
    expect(styleOf(el).boxShadow).toBe("var(--shadow-card)");
    expect(styleOf(el).border).toBe("");
    expect(styleOf(el).borderRadius).toBe("var(--r-lg)");
  });

  it("uses the extra-large radius when it is a hero card", () => {
    const { container } = render(<Card hero>body</Card>);
    expect(styleOf(container.firstChild).borderRadius).toBe("var(--r-xl)");
  });
});

describe("StatTile", () => {
  it("puts navy ink on the tan tile, never white", () => {
    render(<StatTile value="9.660" label="Pending" tone="accent" />);
    expect(styleOf(screen.getByText("9.660")).color).toBe("var(--on-accent)");
    expect(styleOf(screen.getByText("Pending")).color).toBe("var(--on-accent)");
  });

  it("uses primary text on the raised tile", () => {
    render(<StatTile value="4.300" label="Done" dot="var(--success)" />);
    expect(styleOf(screen.getByText("4.300")).color).toBe("var(--text)");
  });
});

describe("Checkbox", () => {
  it("reads as a rounded square rather than a radio", () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} title="t" />);
    const box = container.querySelector("button");
    // 22px box: --r-sm (10px) would render as a circle, which means "pick one".
    expect(styleOf(box).borderRadius).toBe("8px");
    expect(styleOf(box).width).toBe("22px");
  });

  it("fills sage and shows a tick once checked", () => {
    const { container, rerender } = render(<Checkbox checked={false} onChange={() => {}} title="t" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(styleOf(container.querySelector("button")).background).toBe("var(--surface-2)");

    rerender(<Checkbox checked onChange={() => {}} title="t" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(styleOf(container.querySelector("button")).background).toBe("var(--success)");
  });

  it("reports its state to assistive technology, not by colour alone", () => {
    render(<Checkbox checked onChange={() => {}} title="Mark as Pending" />);
    expect(screen.getByTitle("Mark as Pending").getAttribute("aria-pressed")).toBe("true");
  });

  it("fires on click", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} title="t" />);
    fireEvent.click(screen.getByTitle("t"));
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("ProgressBar", () => {
  const segs = (done, pending) => [
    { key: "done", value: done, color: "var(--success)" },
    { key: "pending", value: pending, color: "var(--warning)" },
  ];

  it("sizes each segment by its value", () => {
    const { container } = render(<ProgressBar segments={segs(4300, 5655)} />);
    const bars = [...container.firstChild.children];
    expect(bars.map(b => b.style.flexGrow)).toEqual(["4300", "5655"]);
  });

  it("omits empty segments rather than drawing a zero-width sliver", () => {
    const { container } = render(<ProgressBar segments={segs(4300, 0)} />);
    expect(container.firstChild.children).toHaveLength(1);
  });

  it("renders an empty track when there is nothing to show", () => {
    const { container } = render(<ProgressBar segments={segs(0, 0)} />);
    expect(container.firstChild.children).toHaveLength(0);
    expect(styleOf(container.firstChild).background).toBe("var(--surface-2)");
  });
});

describe("Button", () => {
  it("is a 48px pill in every variant", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"]) {
      const { container, unmount } = render(<Button variant={variant}>Go</Button>);
      const el = container.querySelector("button");
      expect(styleOf(el).borderRadius).toBe("var(--r-pill)");
      expect(styleOf(el).minHeight).toBe("48px");
      unmount();
    }
  });

  it("puts navy on the tan primary fill", () => {
    const { container } = render(<Button>Save</Button>);
    expect(styleOf(container.querySelector("button")).color).toBe("var(--on-accent)");
  });
});

describe("Input", () => {
  it("is a 48px borderless field with the label above it", () => {
    render(<Input label="Username" defaultValue="" />);
    const field = screen.getByRole("textbox");
    expect(styleOf(field).height).toBe("48px");
    // `border: none` reads back as the shorthand's initial width, so the
    // style that actually matters here is the border-style longhand.
    expect(styleOf(field).borderStyle).toBe("none");
    // 16px is what stops iOS zooming the viewport on focus.
    expect(styleOf(field).fontSize).toBe("16px");
    expect(screen.getByText("Username")).toBeTruthy();
  });
});

describe("Sheet", () => {
  it("has a grab handle and rounded top corners", () => {
    const { container } = render(<Sheet label="Finance" onClose={() => {}}>rows</Sheet>);
    const panel = container.querySelector('[role="dialog"]');
    expect(panel.style.borderRadius).toMatch(/^var\(--r-xl\) var\(--r-xl\) 0 0$/);
    expect(panel.firstChild.style.height).toBe("4px");
  });

  it("closes on the backdrop but not on the sheet itself", () => {
    const onClose = vi.fn();
    const { container } = render(<Sheet label="Finance" onClose={onClose}>rows</Sheet>);
    fireEvent.click(container.querySelector('[role="dialog"]'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("SectionHeader and Pill", () => {
  it("sets section labels in the overline style", () => {
    render(<SectionHeader>Split payments</SectionHeader>);
    const el = screen.getByText("Split payments");
    expect(styleOf(el).textTransform).toBe("uppercase");
    expect(styleOf(el).letterSpacing).toBe("1.2px");
  });

  it("draws the default pill as tan on near-black", () => {
    render(<Pill>Expenses</Pill>);
    const el = screen.getByText("Expenses");
    expect(styleOf(el).background).toBe("var(--surface-pill)");
    expect(styleOf(el).color).toBe("var(--accent)");
    expect(styleOf(el).borderRadius).toBe("var(--r-pill)");
  });
});
