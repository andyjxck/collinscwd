"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "../lib/supabase";
import s from "./home.module.css";

/* ── Char-by-char reveal ── */
function AnimChars({
  text,
  delay = 0,
  className = "",
  charDelay = 32,
}: {
  text: string;
  delay?: number;
  className?: string;
  charDelay?: number;
}) {
  return (
    <span className={`${s.animChars} ${className}`} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className={ch === " " ? s.charSpace : s.char}
          style={{ animationDelay: `${delay + i * charDelay}ms` }}
        >
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </span>
  );
}

/* ── Word-by-word reveal ── */
function AnimWords({
  text,
  delay = 0,
  className = "",
  wordDelay = 80,
}: {
  text: string;
  delay?: number;
  className?: string;
  wordDelay?: number;
}) {
  return (
    <span className={`${s.animWords} ${className}`} aria-label={text}>
      {text.split(" ").map((word, i) => (
        <span key={i} className={s.wordOuter}>
          <span
            className={s.wordInner}
            style={{ animationDelay: `${delay + i * wordDelay}ms` }}
          >
            {word}
          </span>
          {i < text.split(" ").length - 1 && <span className={s.wordGap}>&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}

/* ── Reveal on scroll ── */
function useReveal(ref: React.RefObject<Element | null>, threshold = 0.1) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, threshold]);
  return visible;
}

/* ── Typewriter edit: "Selected" → "Perfected" ── */
function TypewriterEdit({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const triggered = useRef(false);
  const [display, setDisplay] = useState("Selected");
  const [phase, setPhase] = useState<"idle"|"deleting"|"typing"|"done">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !triggered.current) {
          triggered.current = true;
          io.disconnect();
          // long pause before starting — let the heading settle
          setTimeout(() => setPhase("deleting"), 1400);
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (phase === "deleting") {
      // backspace only "Sel" — stop at "ected", display as "___ected"
      // We show the full word, delete from front by tracking how many prefix chars remain
      // Simpler: work with suffix "ected" fixed, delete prefix "Sel" char by char
      const prefix = "Sel";
      let count = prefix.length;
      const interval = setInterval(() => {
        count--;
        const remaining = prefix.slice(0, count);
        setDisplay(remaining + "ected");
        if (count <= 0) {
          clearInterval(interval);
          setDisplay("ected");
          setTimeout(() => setPhase("typing"), 320);
        }
      }, 160);
      return () => clearInterval(interval);
    }
    if (phase === "typing") {
      // type "Perf" in front of "ected"
      const toType = "Perf";
      let built = "";
      const interval = setInterval(() => {
        built = toType.slice(0, built.length + 1);
        setDisplay(built + "ected");
        if (built === toType) {
          clearInterval(interval);
          setPhase("done");
        }
      }, 110);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <span ref={ref} className={`${s.typewriterEdit} ${phase !== "idle" && phase !== "done" ? s.typewriterActive : ""}`}>
      {display}
      {(phase === "deleting" || phase === "typing") && <span className={s.typewriterCursor} />}
    </span>
  );
}

/* ── Project image — clip-path reveal, plain img for reliable sizing ── */
function ProjectImage({ src, alt, delay = 0 }: { src: string; alt: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useReveal(ref as React.RefObject<Element | null>);
  return (
    <div
      ref={ref}
      className={`${s.revealImgWrap} ${visible ? s.revealImgVisible : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={s.projectImgPhoto} loading="lazy" />
    </div>
  );
}

/* ── Scroll-driven process bar ── */
const STEPS = [
  { num: "01", title: "Quote",        desc: "Tell us what you're planning. We come back with a detailed written quote — no ranges, no vague estimates." },
  { num: "02", title: "Survey",       desc: "We survey the site, confirm exact measurements and finalise the specification before a single item is ordered." },
  { num: "03", title: "Installation", desc: "Professional installation by our own team. You're updated at every stage through your client dashboard." },
  { num: "04", title: "Sign-off",     desc: "Final walkthrough, snagging resolved, documentation issued. The job is closed only when you're satisfied." },
];

function ScrollProcess() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0–1

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // start animating when top hits 80% of viewport, finish when bottom leaves
      const start = vh * 0.75;
      const end = -height * 0.3;
      const raw = (start - top) / (start - end);
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // which step is active (0-indexed)
  const activeStep = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
  const barPct = progress * 100;

  return (
    <div className={s.scrollProcess} ref={sectionRef}>
      {/* horizontal track */}
      <div className={s.processTrack}>
        <div className={s.processTrackFill} style={{ width: `${barPct}%` }} />
        {STEPS.map((step, i) => {
          const dotPct = (i / (STEPS.length - 1)) * 100;
          const done = i <= activeStep;
          return (
            <div
              key={step.num}
              className={`${s.processDot} ${done ? s.processDotDone : ""}`}
              style={{ left: `${dotPct}%` }}
            />
          );
        })}
      </div>

      {/* step cards below */}
      <div className={s.processSteps}>
        {STEPS.map((step, i) => {
          const done = i <= activeStep;
          return (
            <div key={step.num} className={`${s.processCard} ${done ? s.processCardActive : ""}`}>
              <div className={s.processCardNum}>{step.num}</div>
              <div className={s.processCardTitle}>{step.title}</div>
              <p className={s.processCardDesc}>{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Scroll-driven vertical process (mobile) ── */
function ScrollProcessVertical() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85;
      const end = -height * 0.2;
      const raw = (start - top) / (start - end);
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeStep = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
  const linePct = progress * 100;

  return (
    <div className={s.processVertical} ref={sectionRef}>
      <div className={s.processVerticalLine}>
        <div className={s.processVerticalLineFill} style={{ height: `${linePct}%` }} />
      </div>
      {STEPS.map((step, i) => {
        const done = i <= activeStep;
        return (
          <div key={step.num} className={`${s.processVerticalStep} ${done ? s.processVerticalStepActive : ""}`}>
            <div className={`${s.processVerticalDot} ${done ? s.processVerticalDotDone : ""}`} />
            <div className={s.processVerticalNum}>{step.num}</div>
            <div className={s.processVerticalTitle}>{step.title}</div>
            <p className={s.processVerticalDesc}>{step.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Speech bubble reviews ── */
const REVIEWS = [
  {
    name: "Tracy B.",
    date: "Jul 2023",
    text: "Morgan did the roof on my extension — really well mannered, talked me through everything. Absolutely no issues through all weather since it was built.",
    side: "left" as const,
  },
  {
    name: "Bethany W.",
    date: "Jun 2023",
    text: "Replaced 3 windows in my conservatory. Excellent job ☺️. Could not recommend more.",
    side: "right" as const,
  },
  {
    name: "Andrew B.",
    date: "Jun 2023",
    text: "Had Morgan and his brother come to replace my windows. Amazing job — no more mould issues. Brilliant service.",
    side: "left" as const,
  },
];

function SpeechBubble({ review }: { review: typeof REVIEWS[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [impact, setImpact] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          io.disconnect();
          setVisible(true);
          // fire impact flash ~halfway through the landing animation
          setTimeout(() => { setImpact(true); setTimeout(() => setImpact(false), 520); }, 380);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${s.bubble} ${s[`bubble_${review.side}`]} ${visible ? s.bubbleVisible : ""}`}
    >
      <div className={`${s.bubbleBody} ${impact ? s.bubbleImpact : ""}`}>
        <div className={`${s.bubbleShockwave} ${impact ? s.bubbleShockwaveActive : ""}`} />
        <div className={s.bubbleStars}>
          {[0,1,2,3,4].map(i => <div key={i} className={s.bubbleStar} />)}
        </div>
        <p className={s.bubbleText}>{review.text}</p>
        <div className={s.bubbleMeta}>
          <span className={s.bubbleName}>{review.name}</span>
          <span className={s.bubbleDate}>{review.date}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Animated section wrappers ── */
function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useReveal(ref as React.RefObject<Element | null>);
  return (
    <div
      ref={ref}
      className={`${s.revealSection} ${visible ? s.revealVisible : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function RevealImage({ bg, className = "", delay = 0 }: { bg: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useReveal(ref as React.RefObject<Element | null>);
  return (
    <div ref={ref} className={`${s.revealImgWrap} ${visible ? s.revealImgVisible : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className={s.revealImgInner} style={{ background: bg }} />
    </div>
  );
}

/* ── Services morph — scroll-pinned, one service at a time ── */
const SERVICES = [
  { num: "01", title: "Conservatories", desc: "Design-through-installation. Structural planning, glazing specification and finish — built to outlast the property it extends.", img: "/conservatory.webp" },
  { num: "02", title: "Windows",        desc: "Full replacements, new-builds and specialist openings. Precision-fitted with quality hardware. No shortcuts.",               img: "/windows.JPG" },
  { num: "03", title: "Doors",          desc: "Front doors, bi-fold and patio systems. Multipoint security, premium seals, an entrance that commands attention.",           img: "/door.JPG" },
];

function ServicesMorph() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const pendingIdx = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const el = outerRef.current;
      if (!el) return;
      // scrollY relative to element's top edge in the document
      const elTop = el.getBoundingClientRect().top + window.scrollY;
      const scrolled = window.scrollY - elTop;
      const vh = window.innerHeight;
      // each service occupies 1 viewport-height of scroll distance
      const total = (SERVICES.length - 1) * vh;
      const progress = Math.max(0, Math.min(1, scrolled / total));
      const newIdx = Math.min(SERVICES.length - 1, Math.floor(progress * SERVICES.length + 0.01));
      if (newIdx !== pendingIdx.current) {
        pendingIdx.current = newIdx;
        setExiting(true);
        setTimeout(() => {
          setActiveIdx(newIdx);
          setExiting(false);
        }, 280);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // activeIdx is always clamped 0..SERVICES.length-1 above
  const svc = SERVICES[activeIdx]!;
  const animClass = exiting ? s.servicesMorphExit : s.servicesMorphEnter;
  return (
    <section className={s.servicesMorphOuter} id="services" ref={outerRef}>
      <div className={s.servicesMorphSticky}>
        <div className={s.servicesMorphLayout}>
          {/* Left: text */}
          <div className={s.servicesMorphLeft}>
            <div className={`${s.servicesMorphCard} ${animClass}`}>
              <div className={s.servicesMorphNum}>{svc.num} / 0{SERVICES.length}</div>
              <h2 className={s.servicesMorphTitle}>{svc.title}</h2>
              <p className={s.servicesMorphDesc}>{svc.desc}</p>
              <Link href="#contact" className={s.ctaLink}>
                Enquire <span className={s.arrowLong}>→</span>
              </Link>
            </div>
            <div className={s.servicesMorphDots}>
              {SERVICES.map((_, i) => (
                <div key={i} className={`${s.servicesMorphDot} ${i === activeIdx ? s.servicesMorphDotActive : ""}`} />
              ))}
            </div>
          </div>
          {/* Right: image */}
          <div className={`${s.servicesMorphImgWrap} ${animClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svc.img} alt={svc.title} className={s.servicesMorphImg} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Scroll-morphing statement — words swap as you scroll past ── */
const MORPH_WORDS = ["Built.", "Crafted.", "Installed.", "Delivered.", "Perfected."];
function MorphStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const lastIdx = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const { top } = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // map scroll position within this section to word index
      const progress = Math.max(0, Math.min(1, (vh * 0.7 - top) / (vh * 1.2)));
      const newIdx = Math.min(MORPH_WORDS.length - 1, Math.floor(progress * MORPH_WORDS.length));
      if (newIdx !== lastIdx.current) {
        setFading(true);
        setTimeout(() => {
          setIdx(newIdx);
          lastIdx.current = newIdx;
          setFading(false);
        }, 220);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={s.morphStatement} ref={ref}>
      <span className={s.morphStatic}>Every project.</span>
      {" "}
      <span className={`${s.morphWord} ${fading ? s.morphFading : ""}`}>
        {MORPH_WORDS[idx]}
      </span>
    </div>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"done"|"error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.rpc("zz_submit_lead", {
      p_full_name: name.trim(),
      p_email:     email.trim()   || null,
      p_phone:     phone.trim()   || null,
      p_message:   message.trim() || null,
    });
    if (error) { setStatus("error"); return; }
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className={s.formSuccess}>
        <div className={s.formSuccessTitle}>Enquiry sent ✓</div>
        <p className={s.formSuccessBody}>We'll be in touch with a written quote shortly.</p>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <div className={s.formField}>
        <label className={s.formLabel}>Your name</label>
        <input className={s.formInput} type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className={s.formRow2}>
        <div className={s.formField}>
          <label className={s.formLabel}>Email</label>
          <input className={s.formInput} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className={s.formField}>
          <label className={s.formLabel}>Phone</label>
          <input className={s.formInput} type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>
      <div className={s.formField}>
        <label className={s.formLabel}>What are you looking to install or replace?</label>
        <textarea className={s.formTextarea} rows={4} value={message} onChange={e => setMessage(e.target.value)} />
      </div>
      {status === "error" && <p className={s.formError}>Something went wrong — please try again or call us directly.</p>}
      <button type="submit" className={s.submitBtn} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : <>Send enquiry <span className={s.arrowLong}>→</span></>}
      </button>
    </form>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroBgRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const portalRef = useRef<HTMLDivElement>(null);

  /* hero load trigger */
  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  /* scroll: hero parallax + logo reveal after hero */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroBgRef.current) {
        heroBgRef.current.style.transform = `translateY(${y * 0.38}px) scale(1.12)`;
      }
      if (heroContentRef.current) {
        heroContentRef.current.style.transform = `translateY(${y * 0.2}px)`;
        heroContentRef.current.style.opacity = String(Math.max(0, 1 - y / 520));
      }
      // show logo once we've scrolled past ~80% of viewport height
      const heroHeight = heroRef.current?.offsetHeight ?? window.innerHeight;
      setLogoVisible(y > heroHeight * 0.75);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* close portal on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (portalRef.current && !portalRef.current.contains(e.target as Node)) setPortalOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={s.root}>

      {/* ── Logo — fixed, hidden during hero, fades in after ── */}
      <div className={`${s.logoWrap} ${logoVisible ? s.logoVisible : ""}`}>
        <Image src="/logomaybe.png" alt="Collins' Conservatories, Windows & Doors" width={72} height={72} className={s.logoImg} priority />
      </div>

      {/* ── Portal pill — fixed top-right ── */}
      <div className={s.portalTriggerWrap} ref={portalRef}>
        <button className={s.portalTrigger} onClick={() => setPortalOpen(v => !v)} aria-expanded={portalOpen}>
          <span className={s.portalDot} />
          <span className={s.portalTriggerLabel}>Your Project</span>
          <span className={`${s.portalChevron} ${portalOpen ? s.portalChevronOpen : ""}`}>▾</span>
        </button>
        {portalOpen && (
          <div className={s.portalMenu}>
            <div className={s.portalMenuLabel}>Access your project</div>
            <Link href="/portal/client" className={s.portalMenuItem} onClick={() => setPortalOpen(false)}>
              <div className={s.portalItemTitle}>Client Dashboard</div>
              <div className={s.portalItemSub}>Track your installation, documents &amp; updates</div>
            </Link>
            <Link href="/portal/admin" className={s.portalMenuItemAdmin} onClick={() => setPortalOpen(false)}>
              <div className={s.portalItemTitle}>Staff Portal</div>
              <div className={s.portalItemSub}>Collins team login</div>
            </Link>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          HERO — full viewport, cinematic entrance
          ══════════════════════════════════════════ */}
      <section className={s.hero} ref={heroRef}>
        <div className={s.heroBg} ref={heroBgRef}>
          <div className={s.heroBgImgWrap}>
            <Image
              src="/h1-1.JPG"
              alt="Collins conservatory installation"
              fill
              priority
              quality={90}
              className={s.heroBgImg}
              sizes="100vw"
            />
          </div>
          <div className={s.heroBgOverlayColor} />
          <div className={s.heroBgGrain} />
        </div>
        <div className={s.heroOverlay} />

        <div
          ref={heroContentRef}
          className={`${s.heroContent} ${heroReady ? s.heroReady : ""}`}
        >
          <div className={s.heroEyebrow}>
            <AnimChars text="Collins' Conservatories, Windows & Doors" delay={200} charDelay={18} />
          </div>

          {/* Mobile-only: logo above title */}
          <div className={`${s.heroLogoAbove} ${heroReady ? s.heroLogoAboveReady : ""}`}>
            <Image src="/logomaybe.png" alt="Collins" width={72} height={72} className={s.logoImg} priority />
          </div>

          <div className={s.heroTitleRow}>
            <h1 className={s.h1}>
              <span className={s.h1Line}>
                <AnimWords text="High-Value" delay={500} wordDelay={120} />
              </span>
              <span className={s.h1Line}>
                <AnimWords text="Home" delay={680} wordDelay={120} />
              </span>
              <span className={s.h1Line}>
                <AnimWords text="Improvements." delay={800} wordDelay={120} />
              </span>
            </h1>
            <div className={`${s.heroLogoRight} ${heroReady ? s.heroLogoRightReady : ""}`}>
              <Image src="/logomaybe.png" alt="Collins" width={300} height={300} className={s.logoImg} priority />
            </div>
          </div>

          <p className={`${s.heroLead} ${heroReady ? s.heroLeadReady : ""}`}>
            Conservatories, windows and doors — designed,<br />
            specified and installed to an exacting standard.
          </p>

          <div className={`${s.heroActions} ${heroReady ? s.heroActionsReady : ""}`}>
            <Link href="#contact" className={s.ctaLink}>
              Begin your project <span className={s.arrowLong}>→</span>
            </Link>
            <Link href="#work" className={s.ghostLink}>See the work</Link>
          </div>
        </div>

        <div className={`${s.heroScrollCue} ${heroReady ? s.heroReady : ""}`}>
          <div className={s.scrollTrack}><div className={s.scrollThumb} /></div>
          <span className={s.scrollLabel}>Scroll</span>
        </div>

        <div className={`${s.heroCorner} ${heroReady ? s.heroReady : ""}`}>
          Est. &nbsp;X
        </div>
      </section>

      {/* ── Trust ticker ── */}
      <div className={s.trustStrip}>
        <div className={s.trustTrack} aria-hidden>
          {[0,1].map(copy => (
            <span key={copy} className={s.trustSentence}>
              Collins CW&amp;D&nbsp;&nbsp;|&nbsp;&nbsp;Conservatories&nbsp;&nbsp;|&nbsp;&nbsp;Orangeries&nbsp;&nbsp;|&nbsp;&nbsp;uPVC Windows&nbsp;&nbsp;|&nbsp;&nbsp;Double Glazing&nbsp;&nbsp;|&nbsp;&nbsp;Bi-Fold Doors&nbsp;&nbsp;|&nbsp;&nbsp;Composite Doors&nbsp;&nbsp;|&nbsp;&nbsp;Patio Systems&nbsp;&nbsp;|&nbsp;&nbsp;Redditch &amp; Worcestershire&nbsp;&nbsp;|&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SERVICES — scroll-pinned morph one-at-a-time
          ══════════════════════════════════════════ */}
      <ServicesMorph />

      {/* ══════════════════════════════════════════
          WORK — full-bleed images, clip reveal
          ══════════════════════════════════════════ */}
      <section className={s.work} id="work">
        <div className={s.wrap}>
          <RevealSection><p className={s.label}>Recent installations</p></RevealSection>
          <RevealSection delay={80}>
            <h2 className={s.sectionH2}>
              <TypewriterEdit /> <AnimWords text="work." delay={0} wordDelay={100} />
            </h2>
          </RevealSection>
        </div>

        <div className={s.projectGrid}>
          {([
            { title: "Gable-end conservatory",  img: "/h4-1.JPG" },
            { title: "Orangery with skylights",  img: "/h2-1.JPG" },
            { title: "Lean-to extension",         img: "/h3-1.JPG" },
          ] as { title: string; img: string }[]).map((p, i) => (
            <div key={i} className={s.projectItem}>
              <ProjectImage src={p.img} alt={p.title} delay={i * 90} />
              <RevealSection delay={i * 90 + 120} className={s.projectInfo}>
                <div className={s.projectTitle}>
                  <AnimWords text={p.title} delay={80} wordDelay={70} />
                </div>
              </RevealSection>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PROCESS — scroll-driven progress bar
          ══════════════════════════════════════════ */}
      <section className={s.process} id="process">
        <div className={s.wrap}>
          <RevealSection><p className={s.label}>How it works</p></RevealSection>
          <RevealSection delay={80}>
            <h2 className={s.sectionH2}>
              <AnimWords text="A structured process." delay={0} wordDelay={120} />
              <br />
              <AnimWords text="No surprises." delay={400} wordDelay={120} />
            </h2>
          </RevealSection>
          {/* Desktop horizontal */}
          <ScrollProcess />
          {/* Mobile vertical */}
          <ScrollProcessVertical />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          REVIEWS — speech bubbles
          ══════════════════════════════════════════ */}
      <section className={s.testimonials} id="testimonials">
        <div className={s.wrap}>
          <RevealSection><p className={s.label}>What clients say</p></RevealSection>
          <RevealSection delay={80}>
            <h2 className={s.sectionH2}>
              <AnimWords text="Real reviews." delay={0} wordDelay={120} />
            </h2>
          </RevealSection>
        </div>
        <div className={s.bubblesWrap}>
          {REVIEWS.map((review, i) => (
            <SpeechBubble key={i} review={review} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CONTACT
          ══════════════════════════════════════════ */}
      <section className={s.contact} id="contact">
        <div className={s.contactInner}>
          <RevealSection className={s.contactLeft}>
            <p className={s.label}>Get in touch</p>
            <h2 className={s.contactH2}>
              <AnimWords text="Tell us what" delay={60} wordDelay={90} />
              <br />
              <AnimWords text="you're planning." delay={280} wordDelay={90} />
            </h2>
            <p className={s.contactLead}>
              We'll come back with a detailed written quote.
              No obligation, no pressure.
            </p>
            <div className={s.contactMeta}>
              <span>Redditch &amp; Worcestershire</span>
              <span>Available Mon–Sat</span>
              <span className={s.contactRates}>Competitive Rates · Free Quotes</span>
            </div>
            <div className={s.socialLinks}>
              <a href="https://www.facebook.com/profile.php?id=100092572195886" target="_blank" rel="noopener noreferrer" className={s.socialLink}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
              <a href="https://www.yell.com/biz/collins-conservatories-windows-and-doors-redditch-901761590/" target="_blank" rel="noopener noreferrer" className={s.socialLink}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                Yell
              </a>
            </div>
          </RevealSection>

          <RevealSection delay={140} className={s.contactRight}>
            <ContactForm />
          </RevealSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.footerSub}>Collins · Conservatories · Windows · Doors · Redditch &amp; Worcestershire</span>
        </div>
      </footer>

    </div>
  );
}
