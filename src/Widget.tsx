import React from "react";

export const Widget: React.FC = () => {
  return (
    <div className="welcome-screen">
      <div className="welcome-bg" aria-hidden="true">
        <div className="welcome-bg__base" />
        <div className="welcome-bg__aurora welcome-bg__aurora--one" />
        <div className="welcome-bg__aurora welcome-bg__aurora--two" />
        <div className="welcome-bg__aurora welcome-bg__aurora--three" />
        <div className="welcome-bg__orb welcome-bg__orb--one" />
        <div className="welcome-bg__orb welcome-bg__orb--two" />
        <div className="welcome-bg__orb welcome-bg__orb--three" />
        <div className="welcome-bg__grid" />
        <div className="welcome-bg__stars" />
        <div className="welcome-bg__scanline" />
      </div>

      <div className="welcome-content">
        <p className="welcome-eyebrow">Catalyx Widgets</p>
        <h1 className="welcome-text">Welcome</h1>
        <div className="welcome-glow" aria-hidden="true" />
      </div>
    </div>
  );
};
