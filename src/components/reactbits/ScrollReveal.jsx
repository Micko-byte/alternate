// ScrollReveal from React Bits (JS + CSS variant), with three changes for ALTERNATE:
// - it only removes its own scroll animations when it unmounts (the original killed every ScrollTrigger
//   on the page, which would stop the ScrollFloat headings)
// - the wrapper is a <div> by default (set `as="h2"` for a heading), so body text isn't marked up as a heading
// - nothing moves for people who ask for reduced motion
import { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

const ScrollReveal = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom',
  as: Wrapper = 'div'
}) => {
  const containerRef = useRef(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return (
        <span className="word" key={index}>
          {word}
        </span>
      );
    });
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;
    const tweens = [];

    tweens.push(
      gsap.fromTo(
        el,
        { transformOrigin: '0% 50%', rotate: baseRotation },
        {
          ease: 'none',
          rotate: 0,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom',
            end: rotationEnd,
            scrub: true
          }
        }
      )
    );

    const wordElements = el.querySelectorAll('.word');

    tweens.push(
      gsap.fromTo(
        wordElements,
        { opacity: baseOpacity, willChange: 'opacity' },
        {
          ease: 'none',
          opacity: 1,
          stagger: 0.05,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom-=20%',
            end: wordAnimationEnd,
            scrub: true
          }
        }
      )
    );

    if (enableBlur) {
      tweens.push(
        gsap.fromTo(
          wordElements,
          { filter: `blur(${blurStrength}px)` },
          {
            ease: 'none',
            filter: 'blur(0px)',
            stagger: 0.05,
            scrollTrigger: {
              trigger: el,
              scroller,
              start: 'top bottom-=20%',
              end: wordAnimationEnd,
              scrub: true
            }
          }
        )
      );
    }

    return () => {
      tweens.forEach(tween => {
        tween.scrollTrigger?.kill();
        tween.kill();
      });
    };
  }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength]);

  return (
    <Wrapper ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
      <span className={`scroll-reveal-text ${textClassName}`}>{splitText}</span>
    </Wrapper>
  );
};

export default ScrollReveal;
