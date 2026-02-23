export const BARBERSHOP_PRESETS = [
  {
    key: "classic",
    name: "Classic Barbershop",
    description: "Haircuts, beard, and grooming basics",
    categories: [
      { key: "haircuts", name: "Haircuts", description: "Cuts and styling" },
      { key: "beard", name: "Beard", description: "Trims and shaves" },
      { key: "grooming", name: "Grooming", description: "Extras and care" },
    ],
    services: [
      { categoryKey: "haircuts", name: "Men's Haircut", duration: 30, price: 25, description: "Classic or modern styles" },
      { categoryKey: "haircuts", name: "Skin Fade", duration: 40, price: 30, description: "Tight fade with detail" },
      { categoryKey: "beard", name: "Beard Trim", duration: 20, price: 15, description: "Shape and line-up" },
      { categoryKey: "beard", name: "Hot Towel Shave", duration: 30, price: 20, description: "Traditional shave" },
      { categoryKey: "grooming", name: "Hair Wash", duration: 10, price: 8, description: "Shampoo + conditioner" },
      { categoryKey: "grooming", name: "Eyebrow Cleanup", duration: 10, price: 10, description: "Detail with blade/wax" },
    ],
  },
  {
    key: "premium",
    name: "Premium Lounge",
    description: "Higher-touch services with longer slots",
    categories: [
      { key: "signature", name: "Signature Cuts", description: "Premium haircut experiences" },
      { key: "luxury-beard", name: "Luxury Beard", description: "Beard rituals" },
      { key: "add-ons", name: "Add-ons", description: "Extras to pair with services" },
    ],
    services: [
      { categoryKey: "signature", name: "Signature Cut + Wash", duration: 45, price: 45, description: "Cut, wash, style" },
      { categoryKey: "signature", name: "Restyle / Long Hair", duration: 60, price: 60, description: "For major style changes" },
      { categoryKey: "luxury-beard", name: "Beard Ritual", duration: 35, price: 35, description: "Steam, oils, shape" },
      { categoryKey: "luxury-beard", name: "Beard Fade", duration: 30, price: 30, description: "Fade + detailed line work" },
      { categoryKey: "add-ons", name: "Facial Mask", duration: 20, price: 18, description: "Relaxing mask add-on" },
      { categoryKey: "add-ons", name: "Scalp Massage", duration: 15, price: 15, description: "Add to any cut" },
    ],
  },
  {
    key: "express",
    name: "Express Shop",
    description: "Fast-track menu for quick service shops",
    categories: [
      { key: "quick-cuts", name: "Quick Cuts", description: "Short slots, high throughput" },
      { key: "quick-beard", name: "Quick Beard", description: "Rapid beard services" },
    ],
    services: [
      { categoryKey: "quick-cuts", name: "Buzz Cut", duration: 15, price: 15, description: "Single guard all over" },
      { categoryKey: "quick-cuts", name: "Line-Up", duration: 15, price: 12, description: "Edges and outline only" },
      { categoryKey: "quick-beard", name: "Quick Beard Trim", duration: 15, price: 12, description: "Trim and tidy" },
      { categoryKey: "quick-beard", name: "Moustache Trim", duration: 10, price: 8, description: "Detail moustache" },
    ],
  },
];

