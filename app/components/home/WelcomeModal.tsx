"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Filter, CheckSquare, EyeOff, ArrowRight, FileText, Briefcase, Linkedin, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: Zap,
    title: "Welcome to JobTracker!",
    description: "Hi! Are you tired of searching on LinkedIn, Glassdoor, and other job boards? I originally built this to track my own job search, and it has since evolved to help others as well. It finds jobs, tracks applications, and includes tools that have been beneficial."
  },
  {
    icon: Filter,
    title: "Jobs From All Over The US With Advanced Filtering Features",
    description: "We focus on Tech, Business, healthcare, and more. Slice and dice the job lists to find the perfect fit. Filter by title, skills, location, experience, salary, source, and post date. Hide jobs you're not interested in to focus your search on the best opportunities."
  },
  {
    icon: CheckSquare,
    title: "Track Applications",
    description: "Once you found and applied to some jobs you like, you can mark them to remember them for later. Easily mark jobs as 'Applied' and track your past applications for follow-ups if the job is still up. View all applied jobs on a dedicated page."
  },
  {
    icon: Briefcase,
    title: "AI Resume Tailoring",
    description: "Provide a comprehensive master resume detailing all relevant experience, skills, and projects you have, however small. Use this to create a highly targeted and effective resume for each specific job by picking out the best parts about you to make a new resume tailored to the job you are applying to, how nice of the robots to do that."
  },
  {
    icon: FileText,
    title: "AI Cover Letter Crafting",
    description: "Generate compelling, personalized cover letters based on your resume data and the job description to make a great first impression that sells you as the perfect candidate."
  },
  {
    icon: Linkedin,
    title: "LinkedIn Contact Finder (Automation)",
    description: "Uses browser automation to find potential HR contacts, compared to manual searching the hellscape that is LinkedIn. Find recruiters and hiring managers to get your resume in front of the right people for that first touch to really get your foot in the door."
  },
  {
    icon: Settings,
    title: "Configuration",
    description: "Manage your Gemini API key (needed for AI features) and your saved master resume easily in the Settings page. All of your data is stored locally in your browser but is shared with the API to make the magic happen."
  },
  {
    icon: ArrowRight,
    title: "Thank You!",
    description: "Thanks for checking out JobTracker! I hope it helps your job search!"
  }
];

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0); // 0 initial, 1 next, -1 prev
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const handleNext = () => {
    setDirection(1);
    setCurrentPage((prev) => (prev + 1) % features.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentPage((prev) => (prev - 1 + features.length) % features.length);
  };

  const handleFinish = () => {
    setShowConfetti(true);
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  // Simplified Page Slide Animation Variants (Optimized for Performance)
  const pageSlideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%', // Slide in from the side
      opacity: 0,
      // Removed rotateY and scale for performance
    }),
    center: {
      zIndex: 1,
      x: '0%',
      opacity: 1,
      transition: {
        duration: 0.35, // Slightly faster slide
        ease: [0.4, 0, 0.2, 1], // Smooth cubic bezier
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%', // Slide out to the side
      opacity: 0,
      transition: {
        duration: 0.3, // Faster exit
        ease: [0.4, 0, 1, 1],
      }
    })
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3, delay: 0.1 } }, // Match exit timing better
  };

  const currentFeature = features[currentPage];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {showConfetti && (
            <Confetti
              width={width}
              height={height}
              recycle={false}
              numberOfPieces={500}
              gravity={0.12}
              initialVelocityY={20}
              style={{ zIndex: 1000 }}
              onConfettiComplete={(confettiInstance) => {
                if (confettiInstance) {
                  confettiInstance.reset();
                }
                setShowConfetti(false);
              }}
              tweenDuration={7000}
            />
          )}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose} 
          >
            {/* Modal Content Area */}
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm sm:max-w-md p-6 sm:p-8 relative overflow-hidden border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()} 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, duration: 0.3 }}}
              exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.2 }}}
            >
              {/* Close Button */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors z-20 p-1 rounded-full"
                aria-label="Close modal"
              >
                <X size={22} />
              </motion.button>

              {/* Page Flipping Container -> Renamed to Page Sliding Container */}
              <div className="relative h-80 min-h-[300px] sm:min-h-[320px] flex items-center justify-center mb-4 overflow-hidden"> 
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={currentPage} // Key change triggers animation
                    custom={direction}
                    variants={pageSlideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute w-full flex flex-col items-center text-center px-2 sm:px-4"
                    style={{ transformOrigin: "center center" }}
                  >
                    {/* Animated Content Inside Page */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.25 } }} 
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className="flex flex-col items-center w-full" 
                    >
                      <div className="mb-5 flex-shrink-0 bg-gradient-to-br from-blue-500 to-teal-400 p-3 rounded-full shadow-lg ring-4 ring-white/30 dark:ring-black/30">
                        <currentFeature.icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="font-semibold text-xl lg:text-2xl text-gray-800 dark:text-white mb-3">{currentFeature.title}</h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed px-2">{currentFeature.description}</p>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Controls (Consistent structure) */}
              <div className="flex justify-between items-center h-10"> {/* Fixed height */} 
                {/* Previous Button */}
                <motion.button
                  onClick={handlePrev}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${currentPage === 0 ? 'invisible' : ''}`} // Use invisible to maintain space
                  aria-label="Previous Feature"
                >
                  <ChevronLeft size={24} />
                </motion.button>

                {/* Page Indicator */}
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {currentPage + 1} / {features.length}
                </div>

                {/* Next Button (Conditional) or Spacer */}
                {currentPage < features.length - 1 ? (
                  <motion.button
                    onClick={handleNext}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Next Feature"
                  >
                    <ChevronRight size={24} />
                  </motion.button>
                ) : (
                  <div className="w-10 h-10"></div> // Spacer to keep indicator centered
                )}
              </div>

              {/* Centered Let's Go Button on Last Page */}
              <AnimatePresence>
                {currentPage === features.length - 1 && (
                  <motion.div 
                    className="mt-4 text-center" // Use margin to separate
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.3 }}}
                    exit={{ opacity: 0, y: 5, transition: { duration: 0.15 }}}
                  >
                    <motion.button
                        onClick={handleFinish}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.99 }}
                        className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent rounded-full shadow-md text-base font-medium text-white bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                      >
                        Let's Go!
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal; 