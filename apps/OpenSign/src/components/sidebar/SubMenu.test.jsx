import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { APP_NAME } from "../../constant/brand";
import Submenu from "./SubMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => `${key}:${options?.appName || ""}`
  })
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({
      sidebar: { selectedMenu: false }
    })
}));

vi.mock("react-router", () => ({
  NavLink: ({ children }) => <a href="/">{children}</a>
}));

describe("Submenu", () => {
  it("renders its translated label with the configured application name", () => {
    render(
      <Submenu
        item={{ title: "Settings", icon: "", children: [] }}
        closeSidebar={vi.fn()}
        toggleSubmenu={vi.fn()}
        submenuOpen={{}}
      />
    );

    expect(
      screen.getByText(`sidebar.Settings:${APP_NAME}`)
    ).toBeInTheDocument();
  });
});
