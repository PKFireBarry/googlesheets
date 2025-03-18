"use client";

import { Code } from "lucide-react";
import { useState, useEffect } from "react";

interface ClientSkillsFilterProps {
  skillFilter: string;
  setSkillFilter: (value: string) => void;
  uniqueSkills: string[];
}

export default function ClientSkillsFilter({
  skillFilter,
  setSkillFilter,
  uniqueSkills,
}: ClientSkillsFilterProps) {
  const [mounted, setMounted] = useState(false);

  // Only render the component client-side to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same structure but no values
    return (
      <div>
        <label htmlFor="skill-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Required Skill
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Code className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>
          <select
            id="skill-filter"
            disabled
            className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
          >
            <option value="">Any Skill</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="skill-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Required Skill
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Code className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        <select
          id="skill-filter"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">Any Skill</option>
          {uniqueSkills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
} 