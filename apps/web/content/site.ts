export const site = {
  businessName: "Collins Conservatories Windows and Doors",
  location: "Redditch, Worcestershire",
  phone: "",
  email: "",
  primaryCtaLabel: "Request a quote",
  navigation: [
    { href: "/services", label: "Services" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/testimonials", label: "Testimonials" },
    { href: "/contact", label: "Contact" },
  ],
  hero: {
    headline: "Premium conservatories, windows and doors — designed properly, installed properly.",
    subheadline:
      "A professional installation team for high-value home improvements. Clear timelines, clean workmanship and transparent progress.",
    trustPoints: [
      "Local to Redditch and surrounding areas",
      "Detailed quotes and documentation",
      "Structured job stages from lead to completion",
    ],
  },
  services: [
    {
      title: "Conservatories",
      description:
        "From design and specification through to installation and finishing — built to last and finished to a high standard.",
    },
    {
      title: "Windows",
      description:
        "Energy-efficient replacements and new installations with clean lines, good hardware and careful fitting.",
    },
    {
      title: "Doors",
      description:
        "Front doors, patio and bi-fold solutions with secure locking, premium seals and a quality feel.",
    },
  ],
  portfolio: {
    intro:
      "A small selection of completed installations. Replace these entries with your own projects and images.",
    projects: [
      {
        title: "Conservatory extension",
        location: "Redditch",
        summary: "Bright, warm and clean detailing with matched glazing.",
      },
      {
        title: "Full window replacement",
        location: "Bromsgrove",
        summary: "Modern frames, improved insulation and consistent finish throughout.",
      },
      {
        title: "New composite front door",
        location: "Alvechurch",
        summary: "Secure hardware and a premium exterior look.",
      },
    ],
  },
  testimonials: [
    {
      quote:
        "Clear communication, tidy work and a great finish. The process felt organised from start to end.",
      name: "Homeowner",
      location: "Redditch",
    },
    {
      quote:
        "The quote was detailed and the team kept us updated at each stage. Exactly what we wanted.",
      name: "Homeowner",
      location: "Worcestershire",
    },
    {
      quote:
        "Professional throughout. The installation was clean, on schedule and the quality is excellent.",
      name: "Homeowner",
      location: "Bromsgrove",
    },
  ],
  contact: {
    headline: "Request a quote",
    subheadline:
      "Tell us what you’re looking to install and we’ll come back with next steps. No payment is taken online.",
    address: "",
  },
} as const;
