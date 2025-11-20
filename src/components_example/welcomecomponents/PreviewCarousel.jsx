import React from "react";
import { welcomeStyles } from "./styles/WelcomeStyles";

export default function PreviewCarousel({ backgrounds, bgIndex, fadeIndex, isFading, dragDelta = 0, orientation = 'horizontal' }) {
	const len = backgrounds.length;
	const dragSensitivity = 0.3;
	const dragAngleOffset = -dragDelta * dragSensitivity;
	const vertical = orientation === 'vertical';
	const rootStyle = vertical ? welcomeStyles.previewCarouselRootVertical : welcomeStyles.previewCarouselRoot;
	const innerStyle = vertical ? welcomeStyles.previewCarouselInnerVertical : welcomeStyles.previewCarouselInner;
	return (
		<div style={rootStyle}>
			<div style={innerStyle}>
				{backgrounds.map((bg, idx) => {
					let offset = idx - (isFading ? fadeIndex : bgIndex);
					if (offset < 0) offset += len * (offset < -len / 2 ? 1 : 0);
					if (offset > len / 2) offset -= len;
					const baseAngle = (360 / len) * offset;
					const angle = baseAngle + dragAngleOffset;
					const isActive = offset === 0;
					const opacity = isActive ? 1 : 0.45 + 0.25 * Math.cos((angle * Math.PI) / 180);
					const scale = isActive ? 1.05 : 0.9 + 0.08 * Math.cos((angle * Math.PI) / 180);
					const z = 100 + Math.cos((angle * Math.PI) / 180) * 80;
					let borderGradient = "";
					if (isActive) {
						if (idx === 0 || idx === 1) {
							borderGradient = "linear-gradient(90deg, #ffb6ea, #ff6ac1, #ffb6ea)";
						} else if (idx === 2 || idx === 3) {
							borderGradient = "linear-gradient(90deg, #b6ffb6, #aaff6a, #eaffb6)";
						} else if (idx === 4 || idx === 5) {
							borderGradient = "linear-gradient(90deg, #ffb66a, #ff6a3b, #ffb66a)";
						} else if (idx === 6 || idx === 7) {
							borderGradient = "linear-gradient(90deg, #6ab6ff, #b66aff, #6ab6ff)";
						}
					}
					const itemStyle = welcomeStyles.previewItemStyle({ isActive, opacity, scale, z, angle, borderGradient, orientation });
					return (
						<div key={idx} style={itemStyle}>
							<img src={bg.poster} alt="preview" style={welcomeStyles.previewCarouselImg} />
						</div>
					);
				})}
			</div>
		</div>
	);
}