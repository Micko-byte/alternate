const MarqueeStrip = () => {
  const items = [
    "LIMITED EDITIONS",
    "ARTIST DESIGNED",
    "MADE IN UGANDA",
    "AFFORDABLE LUXURY",
    "STREETWEAR",
    "GEN Z APPROVED",
  ];

  return (
    <div className="bg-primary py-3 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items, ...items, ...items].map((item, index) => (
          <span
            key={index}
            className="font-display text-lg md:text-xl text-primary-foreground mx-8"
          >
            {item} •
          </span>
        ))}
      </div>
    </div>
  );
};

export default MarqueeStrip;
