import React from "react";

export const Background: React.FC = () => (
  <div className="site-bg" aria-hidden="true">
    <div className="site-bg__base" />
    <div className="site-bg__aurora site-bg__aurora--one" />
    <div className="site-bg__aurora site-bg__aurora--two" />
    <div className="site-bg__aurora site-bg__aurora--three" />
    <div className="site-bg__orb site-bg__orb--one" />
    <div className="site-bg__orb site-bg__orb--two" />
    <div className="site-bg__orb site-bg__orb--three" />
    <div className="site-bg__grid" />
    <div className="site-bg__stars" />
    <div className="site-bg__scanline" />
  </div>
);
