// A bound value must already be updated when a component's change callback runs: callers read
// it there (LinksPage's "Only mine", the popup's backend choice, the settings page's mode).
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Checkbox from "./Checkbox.svelte";
import ModeOption from "./ModeOption.svelte";
import SelectField from "./SelectField.svelte";

describe("bound values are current inside change callbacks", () => {
  it("Checkbox", async () => {
    const seen: boolean[] = [];
    const props = $state({ checked: false, label: "Only mine", onchange: () => seen.push(props.checked) });
    render(Checkbox, props);
    await fireEvent.click(screen.getByLabelText("Only mine"));
    await fireEvent.click(screen.getByLabelText("Only mine"));
    expect(seen).toEqual([true, false]);
  });

  it("SelectField", async () => {
    const seen: string[] = [];
    const options = [{ value: "local", label: "This browser" }, { value: "shared", label: "go.example.com" }];
    const props = $state({ label: "Use links from", value: "local", options, onchange: () => seen.push(props.value) });
    render(SelectField, props);
    await fireEvent.change(screen.getByLabelText("Use links from"), { target: { value: "shared" } });
    expect(seen).toEqual(["shared"]);
  });

  it("ModeOption, including a callback that puts the choice back", async () => {
    const seen: string[] = [];
    const props = $state({
      name: "mode", value: "shared", group: "local", title: "Shared",
      onselect: () => {
        seen.push(props.group);
        props.group = "local"; // as the settings page does when no server is saved yet
      },
    });
    render(ModeOption, props);
    await fireEvent.click(screen.getByLabelText("Shared"));
    expect(seen).toEqual(["shared"]);
    expect(props.group).toBe("local");
    expect((screen.getByLabelText("Shared") as HTMLInputElement).checked).toBe(false);
  });
});
