import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

/**
 * Progress bar component for the Resume Builder page
 * Displays the current step in the resume building process
 */
const ProgressBar: React.FC<ProgressBarProps> = ({ 
  currentStep, 
  totalSteps, 
  stepTitles 
}) => {
  return (
    <div className="max-w-4xl mx-auto mb-8">
      <div className="flex justify-between mb-2">
        {stepTitles.map((stepTitle, index) => (
          <div
            key={index}
            className={`text-sm font-medium ${
              currentStep > index + 1 ? 'text-blue-600' : 
              currentStep === index + 1 ? 'text-blue-800' : 
              'text-gray-400'
            }`}
          >
            {stepTitle}
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-200 rounded-full">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar; 