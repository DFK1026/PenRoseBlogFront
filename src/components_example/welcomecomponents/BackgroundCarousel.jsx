import React, { useMemo } from "react";
import { welcomeStyles } from "./styles/WelcomeStyles";

export default function BackgroundCarousel({ backgrounds, bgIndex, fadeIndex, isFading, offsetX = 0, offsetY = 0 }) {
    const scale = 1.08;
    const maxX = 40, maxY = 20;
    const tx = Math.max(-maxX, Math.min(maxX, offsetX));
    const ty = Math.max(-maxY, Math.min(maxY, offsetY));
    const renderIndexes = useMemo(() => {
        const set = new Set([bgIndex]);
        if (isFading && fadeIndex != null) set.add(fadeIndex);
        return Array.from(set.values());
    }, [bgIndex, fadeIndex, isFading]);
    return renderIndexes.map((idx) => {
        const bg = backgrounds[idx];
        if (!bg) return null;
        let opacity = 0;
        let zIndex = 0;
        let className = "";
        if (isFading) {
            if (idx === bgIndex) {
                opacity = 0;
                zIndex = 0;
            } else if (idx === fadeIndex) {
                opacity = 1;
                zIndex = 1;
                className = "wc-fade-in";
            }
        } else if (idx === bgIndex) {
            opacity = 1;
            zIndex = 1;
        }
        const style = {
            ...welcomeStyles.backgroundMediaBase,
            opacity,
            zIndex,
            transform: `scale(${scale}) translate(${tx}px,${ty}px)`
        };
        if (bg.type === "video") {
            return (
                <video
                    key={idx}
                    src={bg.src}
                    poster={bg.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={style}
                    className={className}
                />
            );
        } else if (bg.type === "image") {
            return (
                <img
                    key={idx}
                    src={bg.src}
                    alt="background"
                    style={style}
                    className={className}
                />
            );
        }
        return null;
    });
}