import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowseSearchForm } from "../browse-search-form";

function renderForm(overrides: Partial<Parameters<typeof BrowseSearchForm>[0]> = {}) {
  const onSearch = vi.fn();
  render(
    <BrowseSearchForm
      question="Que prestador procura?"
      hint="Ex.: nome do negócio"
      submitLabel="Pesquisar"
      cityLabel="Cidade"
      allCitiesLabel="Todas as cidades"
      cities={["Maputo", "Beira"]}
      term=""
      city=""
      onSearch={onSearch}
      {...overrides}
    />,
  );
  return onSearch;
}

describe("BrowseSearchForm", () => {
  // The phone's arrow and the desktop's "Pesquisar" are one button drawn two
  // ways; two submit buttons would be two in the accessibility tree.
  it("has one submit button, named Pesquisar at every width", () => {
    renderForm();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Pesquisar" })).toHaveAttribute("type", "submit");
  });

  it("searches the trimmed term and the chosen city", () => {
    const onSearch = renderForm();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  Joaquim  " } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Beira" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    expect(onSearch).toHaveBeenCalledWith({ q: "Joaquim", city: "Beira" });
  });

  it("sends nothing for an empty term or all cities", () => {
    const onSearch = renderForm({ term: "x", city: "Maputo" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "   " } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
    expect(onSearch).toHaveBeenCalledWith({ q: undefined, city: undefined });
  });

  it("offers no city picker with fewer than two cities", () => {
    renderForm({ cities: ["Maputo"] });
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
