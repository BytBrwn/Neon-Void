export type PanelId = "hero" | "features" | "about" | "showcase" | "contact";

export const navLinks: ReadonlyArray<{ id: PanelId; label: string }> = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "about", label: "About" },
  { id: "showcase", label: "Showcase" },
  { id: "contact", label: "Contact" },
];

export const features = [
  {
    icon: "⚡",
    title: "Instant Deploy",
    description:
      "Ship interactive widgets to Foundry in minutes with a modern React toolchain and OSDK integration.",
  },
  {
    icon: "🎨",
    title: "Rich Experiences",
    description:
      "Build immersive UIs with glassmorphism, motion, and responsive layouts that feel native in Workshop.",
  },
  {
    icon: "🔗",
    title: "Ontology Connected",
    description:
      "Wire directly into your objects, actions, and queries through the Ontology SDK out of the box.",
  },
  {
    icon: "🛡️",
    title: "Enterprise Ready",
    description:
      "Auth, token handling, and CI publishing are built in so your team can focus on product logic.",
  },
  {
    icon: "📊",
    title: "Live Parameters",
    description:
      "Expose configurable widget parameters and events that Workshop authors can bind without code.",
  },
  {
    icon: "🚀",
    title: "Fast Iteration",
    description:
      "Hot reload locally, preview standalone, and publish tagged releases through your Foundry pipeline.",
  },
] as const;

export const stats = [
  { value: "99.9%", label: "Uptime target" },
  { value: "<200ms", label: "Interaction latency" },
  { value: "24/7", label: "Operational visibility" },
  { value: "∞", label: "Ontology connections" },
] as const;

export const steps = [
  {
    step: "01",
    title: "Scaffold",
    description: "Start from the Catalyx widget template with Vite, React, and OSDK preconfigured.",
  },
  {
    step: "02",
    title: "Design",
    description: "Craft your experience with parameters, events, and polished UI panels.",
  },
  {
    step: "03",
    title: "Connect",
    description: "Bind ontology resources and platform APIs through the typed client layer.",
  },
  {
    step: "04",
    title: "Publish",
    description: "Run CI to lint, test, build, and deploy your widget set to Foundry environments.",
  },
] as const;

export const testimonials = [
  {
    quote:
      "This template turned our prototype into a production widget in a single sprint.",
    author: "Alex Rivera",
    role: "Product Engineer",
  },
  {
    quote:
      "The animated panel layout is perfect for executive dashboards and demos.",
    author: "Jordan Lee",
    role: "Workshop Builder",
  },
] as const;
