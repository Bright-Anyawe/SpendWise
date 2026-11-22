import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Circle,
  Coffee,
  Dog,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  Music,
  PiggyBank,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Ticket,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icons a category can use, keyed by the name stored in categories.icon. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  house: House,
  zap: Zap,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  "book-open": BookOpen,
  ticket: Ticket,
  gift: Gift,
  briefcase: Briefcase,
  "piggy-bank": PiggyBank,
  ellipsis: Ellipsis,
  coffee: Coffee,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  smartphone: Smartphone,
  wifi: Wifi,
  shirt: Shirt,
  scissors: Scissors,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  baby: Baby,
  dog: Dog,
  "gamepad-2": Gamepad2,
  music: Music,
  wrench: Wrench,
  circle: Circle,
};

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = CATEGORY_ICONS[icon] ?? Circle;
  return <Icon aria-hidden="true" className={cn("size-5", className)} />;
}

/** The mint tile every category icon sits on (colour never identifies a category). */
export function CategoryTile({ icon, size = "md" }: { icon: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-secondary text-primary",
        size === "md" ? "size-10 rounded-[12px]" : "size-8 rounded-[10px]",
      )}
    >
      <CategoryIcon icon={icon} className={size === "md" ? "size-5" : "size-[17px]"} />
    </span>
  );
}
