"use client";

import { useState } from "react";
import { FileText, Construction } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CoverLetterPage() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-500" />
            Cover Letter Generator
          </h1>
          
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Back
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <Construction className="w-20 h-20 text-amber-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Coming Soon
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                We're working on an intelligent cover letter generator that will create compelling, personalized cover letters using the job posting details and Google's Gemini API.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-md w-full max-w-xl">
                <h3 className="text-amber-800 dark:text-amber-400 font-medium mb-2">
                  Features coming in the next update:
                </h3>
                <ul className="text-amber-700 dark:text-amber-300 text-sm text-left list-disc list-inside space-y-1">
                  <li>Personalized cover letters tailored to each job</li>
                  <li>Highlights your relevant skills based on job requirements</li>
                  <li>Multiple style options (formal, conversational, creative)</li>
                  <li>Easy export to PDF or copy to clipboard</li>
                  <li>Save templates for future use</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 