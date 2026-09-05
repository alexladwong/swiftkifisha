import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Package, Mail, Phone, Globe2, MapPin, Lock, Radio, Wallet, ShieldCheck,
  ArrowRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthDialog from "@/components/AuthDialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

const NAV_GROUPS = [
  {
    key: "groupPlatform",
    links: [
      { labelKey: "nav.kifisha", to: "/shop-ship" },
      { labelKey: "footer.linkMailboxAddresses", to: "/shop-ship" },
      { labelKey: "footer.linkEstimateFees", to: "/calculate" },
      { labelKey: "footer.linkTrack", to: "/track" },
      { labelKey: "footer.linkMemberPortal", to: "/account" },
    ],
  },
  {
    key: "groupResources",
    links: [
      { labelKey: "footer.linkHowItWorks", to: "/shop-ship" },
      { labelKey: "footer.linkFeeCalculator", to: "/calculate" },
      { labelKey: "footer.linkHubCountries", to: "/shop-ship" },
      { labelKey: "drawer.contactSupport", to: "/contact" },
      { labelKey: "footer.linkApiStatus", to: "https://precise-pig-300.convex.site/api/health", external: true },
    ],
  },
  {
    key: "groupCompany",
    links: [
      { labelKey: "footer.linkOurStory", to: "/about" },
      { labelKey: "footer.linkContact", to: "/contact" },
      { labelKey: "footer.linkBecomeMember", to: "/shop-ship" },
      { labelKey: "footer.linkHome", to: "/" },
    ],
  },
  {
    key: "groupSupport",
    links: [
      { labelKey: "drawer.helpCentre", to: "/contact" },
      { labelKey: "footer.linkEmailSupport", to: "mailto:care@SwiftKifisha.com", external: true },
      { labelKey: "footer.linkReportIssue", to: "mailto:care@SwiftKifisha.com", external: true },
      { labelKey: "footer.linkTrackYourParcel", to: "/track" },
    ],
  },
];

const TRUST_ITEMS = [
  { icon: Lock, labelKey: "footer.trustSecure" },
  { icon: ShieldCheck, labelKey: "footer.trustEncrypted" },
  { icon: Radio, labelKey: "footer.trustLiveTracking" },
  { icon: Wallet, labelKey: "footer.trustTransparent" },
];

function FooterLink({ link, onNavigate }) {
  const { t } = useI18n();
  const label = t(link.labelKey);
  const inner = link.external ? (
    <>
      {label} <ExternalLink className="h-3.5 w-3.5 opacity-60" />
    </>
  ) : (
    label
  );
  return (
    <li>
      {link.external ? (
        <a
          href={link.to}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 text-[15px] text-white/65 transition-all duration-150 hover:translate-x-0.5 hover:text-white"
        >
          {inner}
        </a>
      ) : (
        <Link
          to={link.to}
          onClick={onNavigate}
          className="group inline-flex items-center gap-1.5 text-[15px] text-white/65 transition-all duration-150 hover:translate-x-0.5 hover:text-white"
        >
          {inner}
        </Link>
      )}
    </li>
  );
}

function FooterLinkColumns({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8 lg:gap-12">
      {NAV_GROUPS.map((group) => (
        <nav key={group.key} aria-label={t("footer.navAriaGroup", { group: t("footer." + group.key) })}>
          <h3 className="mb-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">{t("footer." + group.key)}</h3>
          <ul className="space-y-3">
            {group.links.map((link) => (
              <FooterLink key={group.key + link.labelKey} link={link} onNavigate={onNavigate} />
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}

function FooterAccordion({ onNavigate }) {
  const { t } = useI18n();
  const [openGroup, setOpenGroup] = useState(null);
  return (
    <div className="md:hidden">
      {NAV_GROUPS.map((group) => {
        const open = openGroup === group.key;
        return (
          <div key={group.key} className="border-b border-white/10">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={"footer-panel-" + group.key}
              onClick={() => setOpenGroup(open ? null : group.key)}
              className="flex w-full items-center justify-between py-4 text-left text-[13px] font-bold uppercase tracking-[0.12em] text-white/75"
            >
              {t("footer." + group.key)}
              <ChevronDown className={"h-4 w-4 text-white/50 transition-transform duration-200 " + (open ? "rotate-180" : "")} />
            </button>
            {open && (
              <ul id={"footer-panel-" + group.key} className="space-y-3 pb-5">
                {group.links.map((link) => (
                  <FooterLink key={group.key + link.labelKey} link={link} onNavigate={onNavigate} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PreFooterCta() {
  const { t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);
  const { token, user } = useSelector((state) => state.auth);
  return (
    <section aria-labelledby="footer-cta-heading" className="border-b border-white/10 bg-[#0e1c42]">
      <div className="shell-md py-14 text-center md:py-16">
        <h2 id="footer-cta-heading" className="text-balance mx-auto max-w-[560px] font-display text-2xl font-extrabold tracking-tight text-white md:text-4xl">
          {t("footer.ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-[480px] text-pretty text-[15px] leading-relaxed text-white/65 md:text-base">
          {t("footer.ctaSubtitle")}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {token && user ? (
            <Link to="/account">
              <Button className="h-12 w-full gap-2 bg-accent px-6 text-[15px] font-bold text-accent-foreground shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto">
                {t("footer.ctaOpenPortal")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => setAuthOpen(true)}
              className="h-12 w-full gap-2 bg-accent px-6 text-[15px] font-bold text-accent-foreground shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto"
            >
              {t("footer.ctaCreateAccount")} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Link to="/contact" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="h-12 w-full border-white/25 bg-transparent px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 sm:w-auto"
            >
              {t("common.contactUs")}
            </Button>
          </Link>
        </div>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
      </div>
    </section>
  );
}

export default function Footer() {
  const { t } = useI18n();
  const { token, user } = useSelector((state) => state.auth);
  const location = useLocation();

  const closeIfMobile = () => {
    /* accordion collapses on its own; nothing else to close */
  };

  return (
    <>
      <PreFooterCta />

      <footer className="relative overflow-hidden bg-[#0b1633] text-white">
        {/* Subtle depth: faint radial glow + faint grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(224 76% 55% / 0.14), transparent 70%), linear-gradient(hsl(0 0% 100% / 0.028) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.028) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 44px 44px, 44px 44px",
          }}
        />

        <div className="shell-md relative pt-16 md:pt-24">
          {/* Top: brand + newsletter-free product access */}
          <div className="grid gap-12 pb-14 md:grid-cols-12 md:gap-10">
            {/* Brand */}
            <div className="md:col-span-5 lg:col-span-4">
              <Link to="/" className="inline-flex items-center gap-2.5" aria-label={t("footer.brandAria")}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                  <Package className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="font-display text-[22px] font-extrabold tracking-tight text-white">
                  Swift<span className="text-accent">Kifisha</span>
                </span>
              </Link>

              <p className="mt-5 max-w-[340px] text-pretty text-[15px] leading-relaxed text-white/60">
                {t("footer.tagline")}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[13px] font-medium text-white/75">
                  <MapPin className="h-3.5 w-3.5 text-accent" /> {t("footer.kampala")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[13px] font-medium text-white/75">
                  <Globe2 className="h-3.5 w-3.5 text-accent" /> {t("footer.serving")}
                </span>
              </div>

              <div className="mt-8">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">{t("footer.contactHeading")}</p>
                <ul className="mt-3 space-y-2.5 text-[15px] text-white/70">
                  <li>
                    <a href="mailto:care@SwiftKifisha.com" className="inline-flex items-center gap-2 transition-colors hover:text-white">
                      <Mail className="h-4 w-4 text-accent" /> care@SwiftKifisha.com
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-accent" /> +971 4 123 4567
                  </li>
                </ul>
              </div>
            </div>

            {/* Link columns */}
            <div className="md:col-span-7 lg:col-span-8">
              <FooterLinkColumns onNavigate={closeIfMobile} />
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="border-t border-white/10 pb-8 md:hidden">
            <FooterAccordion onNavigate={closeIfMobile} />
          </div>

          {/* Trust signals */}
          <div className="grid gap-4 border-t border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_ITEMS.map((item) => (
              <div key={item.labelKey} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-accent">
                  <item.icon className="text-accent" style={{ width: 18, height: 18 }} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-medium text-white/70">{t(item.labelKey)}</span>
              </div>
            ))}
          </div>

          {/* Bottom utility bar */}
          <div className="flex flex-col gap-5 border-t border-white/10 py-7 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[13px] text-white/45">
              {t("footer.rights", { year: new Date().getFullYear() })}
            </p>

            <nav aria-label={t("footer.navAriaUtility")} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              {[
                { labelKey: "nav.home", to: "/" },
                { labelKey: "nav.kifisha", to: "/shop-ship" },
                { labelKey: "nav.track", to: "/track" },
                { labelKey: "nav.estimate", to: "/calculate" },
                { labelKey: "nav.about", to: "/about" },
                { labelKey: "nav.contact", to: "/contact" },
              ].map((l) => (
                <Link
                  key={l.labelKey}
                  to={l.to}
                  className={
                    "transition-colors duration-150 hover:text-white " +
                    (location.pathname === l.to ? "text-white" : "text-white/55")
                  }
                >
                  {t(l.labelKey)}
                </Link>
              ))}
              {token && user ? (
                <Link to="/account" className="text-white/55 transition-colors duration-150 hover:text-white">
                  {t("footer.myAccount")}
                </Link>
              ) : null}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <LanguageSwitcher tone="dark" compact />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1 text-[12px] font-medium text-white/60">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" /> {t("footer.systemsOperational")}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
