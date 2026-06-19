import React from "react";

const particleCount = 18;

export const Background: React.FC = () => (
  <div className="site-bg" aria-hidden="true">
    <div className="site-bg__base" />
    <div className="site-bg__aurora site-bg__aurora--one" />
    <div className="site-bg__aurora site-bg__aurora--two" />
    <div className="site-bg__aurora site-bg__aurora--three" />
    <div className="site-bg__aurora site-bg__aurora--four" />
    <div className="site-bg__orb site-bg__orb--one" />
    <div className="site-bg__orb site-bg__orb--two" />
    <div className="site-bg__orb site-bg__orb--three" />
    <div className="site-bg__orb site-bg__orb--four" />
    <div className="site-bg__orb site-bg__orb--five" />
    <div className="site-bg__beams" />
    <div className="site-bg__hex" />
    <div className="site-bg__grid" />
    <div className="site-bg__constellation" />
    <div className="site-bg__stars" />
    <div className="site-bg__dust" />
    <div className="site-bg__particles">
      {Array.from({ length: particleCount }, (_, index) => (
        <span className="site-bg__particle" key={index} />
      ))}
    </div>
    <div className="site-bg__ring site-bg__ring--one" />
    <div className="site-bg__ring site-bg__ring--two" />
    <div className="site-bg__ring site-bg__ring--three" />
    <div className="site-bg__vignette" />
    <div className="site-bg__noise" />
    <div className="site-bg__scanline" />
  </div>
);
