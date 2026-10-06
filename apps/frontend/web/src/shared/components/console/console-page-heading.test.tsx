import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeaderContext, type PageHeaderState } from "@/shared/lib/page-header";
import { ConsolePageHeading } from "./console-page-heading";

function renderHeading(header: PageHeaderState, action: React.ReactNode = null) {
  return render(
    <PageHeaderContext.Provider value={{ header, setHeader: () => {}, action, setAction: () => {} }}>
      <ConsolePageHeading />
    </PageHeaderContext.Provider>,
  );
}

describe("ConsolePageHeading", () => {
  it("prints the page's title and subtitle above the page", () => {
    renderHeading({ title: "Reservas", subtitle: "Pedidos por responder" });
    expect(screen.getByRole("heading", { level: 1, name: "Reservas" })).toBeInTheDocument();
    expect(screen.getByText("Pedidos por responder")).toBeInTheDocument();
  });

  it("does not print a title a detail page already draws itself, but keeps its action", () => {
    renderHeading({ title: "Cora Customer", ownHeading: true }, <button type="button">Editar</button>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });
});
