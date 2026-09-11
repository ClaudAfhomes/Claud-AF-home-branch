export interface NavItem {
  label: string;
  path: string;
  description?: string;
}

export interface ContactLink {
  label: string;
  href: string;
}

export interface OfficeAddress {
  name: string;
  role: string;
  lines: string[];
}

export interface SiteBrand {
  name: string;
  tagline: string;
  mantra: string;
}

export interface SiteConfig {
  siteUrl: string;
  brand: SiteBrand;
  email: string;
  phone: string;
  phoneDisplay: string;
  footerEyebrow: string;
  footerTitle: string;
  footerNoticeTitle: string;
  footerNoticeBody: string;
  footerCopyright: string;
  footerExploreLabel: string;
  footerExperiencesLabel: string;
  footerContactLabel: string;
  footerOfficesLabel: string;
  offices: OfficeAddress[];
  nav: {
    main: NavItem[];
    experiences: NavItem[];
  };
}
