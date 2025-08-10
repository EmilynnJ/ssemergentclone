import React from 'react';

/**
 * AboutPage
 *
 * This component renders the About page for the SoulSeer application.
 * It uses the custom TailwindCSS theme defined in `tailwind.config.js` to
 * apply the celestial dark-mode aesthetic. The page introduces visitors
 * to SoulSeer, explains the platform’s mission, and highlights our
 * founder, Emilynn. Images are pulled from remote storage as specified
 * in the project configuration.
 */
const AboutPage = () => {
  return (
    <div className="min-h-screen bg-soul-black text-soul-gray-100 flex flex-col items-center py-12 px-6 space-y-12">
      {/* Header */}
      <h1 className="text-5xl md:text-7xl font-alex-brush text-soul-pink text-center drop-shadow-lg">
        About SoulSeer
      </h1>

      {/* Content container */}
      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start space-y-10 md:space-y-0 md:space-x-12">
        {/* Founder image */}
        <div className="flex-shrink-0">
          <img
            src="https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg"
            alt="Founder Emilynn"
            className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-soul-gold shadow-2xl"
          />
        </div>

        {/* Text content */}
        <div className="flex-1 text-lg md:text-xl font-playfair leading-relaxed space-y-4">
          <p className="font-semibold">
            At SoulSeer, we are dedicated to providing ethical, compassionate, and judgment‑free spiritual guidance.
          </p>
          <p>
            Our mission is twofold: to offer clients genuine, heart‑centered readings and to uphold fair, ethical standards for our
            readers.
          </p>
          <p>
            Founded by psychic medium Emilynn, SoulSeer was created as a response to the corporate greed that dominates many psychic
            platforms. Unlike other apps, our readers keep the majority of what they earn and play an active role in shaping the
            platform.
          </p>
          <p>
            SoulSeer is more than just an app—it’s a soul tribe. A community of gifted psychics united by our life’s calling:
            to guide, heal, and empower those who seek clarity on their journey.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;