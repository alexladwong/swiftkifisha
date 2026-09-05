import { motion } from "framer-motion";

export default function SectionHeading({ eyebrow, title, subtitle, align = "center" }) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45 }}
      className={"max-w-2xl " + alignCls}
    >
      {eyebrow && (
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      )}
      <h2 className="text-balance font-display text-[28px] font-bold leading-[1.15] tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3.5 text-pretty text-base leading-relaxed text-muted-foreground md:text-[17px]">{subtitle}</p>}
    </motion.div>
  );
}
