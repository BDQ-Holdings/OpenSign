export const APP_NAME = "Sign By BDQ";
export const APP_SHORT_NAME = "BDQ Sign";
export const APP_DESCRIPTION =
  "Securely send, sign, and manage documents with Sign By BDQ.";
export const APP_COLOR = "#222222";
export const APP_LOGO = "/brand/sign-by-bdq.svg";
export const APP_FAVICON = "/brand/bdq-emblem.svg";
export const APP_EMAIL_LOGO = "/brand/sign-by-bdq-email.png";
export const COMPANY_WEBSITE = "https://bdqholdings.com";
export const SUPPORT_EMAIL = "drmustafa@bdqholdings.com";
export const FORK_REPOSITORY = "https://github.com/BDQ-Holdings/OpenSign";
export const COMPANY_LINKEDIN =
  "https://www.linkedin.com/in/drmustafaboorenie";
export const COMPANY_X = "https://twitter.com/MustafaBoorenie";
export const UPSTREAM_NAME = "OpenSign™";
export const UPSTREAM_REPOSITORY = "https://github.com/OpenSignLabs/OpenSign";
export const BRAND_UPDATED_EVENT = "opensign:brand-updated";

export function storeBrand({
  appName = APP_NAME,
  logo = APP_LOGO,
  favicon = APP_FAVICON
} = {}) {
  if (typeof window === "undefined") return;

  localStorage.setItem("appname", appName);
  localStorage.setItem("appLogo", logo);
  localStorage.setItem("fev_Icon", favicon);
  localStorage.setItem("favicon", favicon);
  window.dispatchEvent(
    new CustomEvent(BRAND_UPDATED_EVENT, {
      detail: { appName, logo, favicon }
    })
  );
}
