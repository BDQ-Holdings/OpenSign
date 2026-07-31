import React from "react";
import {
  APP_NAME,
  COMPANY_LINKEDIN,
  COMPANY_WEBSITE,
  COMPANY_X,
  FORK_REPOSITORY,
  SUPPORT_EMAIL
} from "../constant/brand";

const SocialMedia = () => {
  return (
    <React.Fragment>
      <a
        href={FORK_REPOSITORY}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${APP_NAME} source code on GitHub`}
      >
        <i aria-hidden="true" className="fa-brands fa-github"></i>
      </a>
      <a
        href={COMPANY_WEBSITE}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="BDQ Holdings website"
      >
        <i aria-hidden="true" className="fa-light fa-globe"></i>
      </a>
      <a
        href={COMPANY_LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="BDQ Holdings on LinkedIn"
      >
        <i aria-hidden="true" className="fa-brands fa-linkedin"></i>
      </a>
      <a
        href={COMPANY_X}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="BDQ Holdings on X"
      >
        <i aria-hidden="true" className="fa-brands fa-square-x-twitter"></i>
      </a>
      <a href={`mailto:${SUPPORT_EMAIL}`} aria-label={`Email ${APP_NAME}`}>
        <i aria-hidden="true" className="fa-light fa-envelope"></i>
      </a>
    </React.Fragment>
  );
};

export default SocialMedia;
