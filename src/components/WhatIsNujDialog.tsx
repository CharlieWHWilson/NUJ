import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import {
  Check, Crown, HelpCircle, MessageCircle, Share2, UserRound, UserRoundPlus, UsersRound, type LucideIcon,
} from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi,
} from "@/components/ui/carousel";

type ExplainerSymbol = { icon: LucideIcon; emoji?: never } | { emoji: string; icon?: never };
type ExplainerSlide = ExplainerSymbol & {
  title: string;
  tone: string;
  description: string;
  details: string;
  features: Array<ExplainerSymbol & { label: string }>;
};

const slides: ExplainerSlide[] = [
  {
    title: "Stay connected",
    emoji: "👋",
    tone: "bg-secondary",
    description: "NUJ is the easy way to stay connected with mates. No pressure, guilt or obligation to send a message.",
    details: "Life gets busy, contact drifts and keeping in touch gets harder. NUJ makes it easy to acknowledge each other regularly, even when nothing needs to be said.",
    features: [{ emoji: "👍", label: "No pressure" }, { emoji: "👋", label: "Stay connected" }],
  },
  {
    title: "Check in",
    emoji: "👍",
    tone: "bg-emerald-50",
    description: "Tap once to say you're around. It takes a second. Nothing more needed.",
    details: "Set a reminder so you don't forget. See when your mates last checked in.",
    features: [{ emoji: "👍", label: "One tap" }, { emoji: "👋", label: "See who's around" }],
  },
  {
    title: "Add mates",
    emoji: "👤︎",
    tone: "bg-secondary",
    description: "Share your NUJ code (in your profile) with friends, or enter theirs to connect.",
    details: "You become mates when a request is accepted. A personal choice, on both sides.",
    features: [{ icon: UserRoundPlus, label: "Request" }, { icon: Check, label: "Accept" }],
  },
  {
    title: "Personal groups",
    icon: UserRound,
    tone: "bg-muted",
    description: "Create personal groups to keep track of your mates. Only you see these groups.",
    details: "Choose a check-in cadence that suits each group, from daily to monthly.",
    features: [{ icon: UserRound, label: "Just for you" }, { emoji: "👋", label: "Keep track of mates" }],
  },
  {
    title: "Shared groups",
    icon: UsersRound,
    tone: "bg-secondary",
    description: "Create a shared group and share a link or seven-character group code so your mates can join.",
    details: "See names and check-in status together. Joining a group doesn't automatically add individual mates.",
    features: [{ icon: Share2, label: "Share invite" }, { icon: Crown, label: "Group owner" }],
  },
  {
    title: "Gentle nudges",
    emoji: "👉",
    tone: "bg-amber-50",
    description: "If someone's been quiet, send a small NUJ to let them know you're thinking of them.",
    details: "A silent signal. No words needed. Stay connected.",
    features: [{ emoji: "👉", label: "Send a NUJ" }, { emoji: "👋", label: "Say you're around" }],
  },
];

export const WhatIsNujDialog = ({ trigger }: { trigger?: ReactElement } = {}) => {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const select = () => setSelected(api.selectedScrollSnap());
    select();
    api.on("select", select);
    api.on("reInit", select);
    return () => {
      api.off("select", select);
      api.off("reInit", select);
    };
  }, [api]);

  return <Dialog onOpenChange={() => setSelected(0)}>
    <DialogTrigger asChild>
      {trigger ?? <button className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors" aria-label="What is NUJ?">
        <HelpCircle size={21} />
      </button>}
    </DialogTrigger>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg p-0 gap-0 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col">
      <DialogHeader className="shrink-0 px-6 pt-6 pb-3 text-left">
        <DialogTitle className="pr-16 text-black">What is NUJ?</DialogTitle>
        <DialogDescription className="sr-only">A quick introduction to check-ins, mates, personal groups, shared groups and NUJs.</DialogDescription>
      </DialogHeader>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="absolute right-10 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Get in touch" title="Get in touch"><MessageCircle size={16} /></button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle>Get in touch</DialogTitle>
            <DialogDescription>If you have any questions or would like to share feedback I'd love to hear from you</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium text-foreground text-center">charlie@nuj.social</p>
          <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-center gap-3">
            <Link to="/support" className="underline underline-offset-2">Support</Link>
            <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
            <Link to="/terms" className="underline underline-offset-2">Terms of Use</Link>
          </div>
        </DialogContent>
      </Dialog>
      <Carousel setApi={setApi} opts={{ align: "start", loop: false }} className="min-h-0 flex-1 overflow-y-auto" aria-label="About NUJ">
        <CarouselContent className="items-stretch">
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            return <CarouselItem key={slide.title} aria-label={`${index + 1} of ${slides.length}`} aria-hidden={selected !== index}>
              <div className="h-full min-h-[22rem] px-6 pt-3 pb-5 flex flex-col items-center text-center">
                <div className={`h-24 w-24 shrink-0 rounded-full flex items-center justify-center mb-5 ${slide.tone}`} aria-hidden="true">
                  {Icon ? <Icon size={44} strokeWidth={1.5} /> : <span className="text-5xl leading-none">{slide.emoji}</span>}
                </div>
                <h2 className="text-xl font-semibold text-black">{slide.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{slide.description}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{slide.details}</p>
                <div className="mt-auto pt-5 grid w-full grid-cols-2 gap-3 text-muted-foreground">
                  {slide.features.map((feature) => {
                    const FeatureIcon = feature.icon;
                    return <div key={feature.label} className="flex flex-col items-center gap-2">
                      {FeatureIcon ? <FeatureIcon size={20} strokeWidth={1.5} aria-hidden="true" /> : <span className="text-xl leading-5" aria-hidden="true">{feature.emoji}</span>}
                      <span className="text-xs leading-snug">{feature.label}</span>
                    </div>;
                  })}
                </div>
              </div>
            </CarouselItem>;
          })}
        </CarouselContent>
        <div className="sticky bottom-0 bg-background px-5 py-4 border-t border-border flex items-center justify-between gap-2">
          <CarouselPrevious className="static h-9 w-9 shrink-0 translate-x-0 translate-y-0" title="Previous slide" />
          <div className="flex items-center" aria-label="Choose a slide">
            {slides.map((slide, index) => <button key={slide.title} onClick={() => api?.scrollTo(index)}
              className="h-8 w-6 flex items-center justify-center" aria-label={`Go to slide ${index + 1}: ${slide.title}`} aria-current={selected === index ? "step" : undefined}>
              <span className={`h-1.5 w-1.5 rounded-full ${selected === index ? "bg-foreground" : "bg-foreground/20"}`} />
            </button>)}
          </div>
          {selected === slides.length - 1
            ? <DialogClose asChild><button className="h-9 min-w-9 text-xs font-medium">Done</button></DialogClose>
            : <CarouselNext className="static h-9 w-9 shrink-0 translate-x-0 translate-y-0" title="Next slide" />}
        </div>
        <p className="sr-only" role="status" aria-live="polite">Slide {selected + 1} of {slides.length}: {slides[selected].title}</p>
      </Carousel>
    </DialogContent>
  </Dialog>;
};