import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarUpload, LogoUpload } from "../image-upload";

const CROP_STRINGS = {
  title: "Crop",
  hint: "Frame the image",
  cancel: "Cancel",
  confirm: "Confirm",
  zoom: "Zoom",
};

describe("LogoUpload shape prop", () => {
  test("shape='round' puts rounded-full on the preview button", () => {
    render(
      <LogoUpload
        onSelect={() => {}}
        cropStrings={CROP_STRINGS}
        label="Logo"
        hint="Upload a logo"
        chooseText="Choose"
        replaceText="Replace"
        removeText="Remove"
        shape="round"
      />,
    );
    const button = screen.getByRole("button", { name: "Logo" });
    expect(button).toHaveClass("rounded-full");
    expect(button).not.toHaveClass("rounded-[var(--radius-card-sm)]");
  });

  test("omitting shape defaults to square radius", () => {
    render(
      <LogoUpload
        onSelect={() => {}}
        cropStrings={CROP_STRINGS}
        label="Logo"
        hint="Upload a logo"
        chooseText="Choose"
        replaceText="Replace"
        removeText="Remove"
      />,
    );
    const button = screen.getByRole("button", { name: "Logo" });
    expect(button).toHaveClass("rounded-[var(--radius-card-sm)]");
    expect(button).not.toHaveClass("rounded-full");
  });
});

describe("AvatarUpload", () => {
  test("is one control: the avatar itself, named by what it does", () => {
    // The point of the component. The profile page already draws the person
    // at the top; a second framed preview with its own label and buttons put
    // two avatars on screen, one under the other.
    render(
      <AvatarUpload
        onSelect={() => {}}
        cropStrings={CROP_STRINGS}
        changeLabel="Change photo"
        fallback={<span>AS</span>}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  test("shows the photo instead of the fallback once there is one", () => {
    render(
      <AvatarUpload
        url="https://example.test/me.jpg"
        onSelect={() => {}}
        cropStrings={CROP_STRINGS}
        changeLabel="Change photo"
        fallback={<span>AS</span>}
      />,
    );
    const image = screen.getByRole("button", { name: "Change photo" }).querySelector("img");
    expect(image).toHaveAttribute("src", "https://example.test/me.jpg");
    expect(screen.queryByText("AS")).not.toBeInTheDocument();
  });

  test("cannot be opened again while an upload is in flight", () => {
    render(
      <AvatarUpload
        busy
        onSelect={() => {}}
        cropStrings={CROP_STRINGS}
        changeLabel="Change photo"
      />,
    );
    expect(screen.getByRole("button", { name: "Change photo" })).toBeDisabled();
  });
});
