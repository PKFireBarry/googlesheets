import React from 'react';
import JobCardGrid from '../JobCardGrid';
import { FilteredRow } from '../../types/data';

interface JobResultsGridProps {
  jobs: FilteredRow[];
  headers: string[];
  appliedJobs: string[];
  onApply: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onUpdateNote: (rowIndex: number, note: string, columnIndex: number) => void;
  onHide?: (jobId: string, title: string, company: string) => void;
  viewMode: 'card' | 'list';
  onToggleViewMode: () => void;
  onAddSkillFilter: (skill: string) => void;
  onAddSourceFilter: (source: string) => void;
}

/**
 * Job Results Grid component
 * Displays job results in either card or list view
 */
const JobResultsGrid: React.FC<JobResultsGridProps> = ({
  jobs,
  headers,
  appliedJobs,
  onApply,
  onDelete,
  onUpdateNote,
  onHide,
  viewMode,
  onToggleViewMode,
  onAddSkillFilter,
  onAddSourceFilter
}) => {
  return (
    <div className="pb-8 sm:pb-12">
      <JobCardGrid
        jobs={jobs}
        headers={headers}
        appliedJobs={appliedJobs}
        onApply={onApply}
        onDelete={onDelete}
        onUpdateNote={onUpdateNote}
        onHide={onHide}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        onAddSkillFilter={onAddSkillFilter}
        onAddSourceFilter={onAddSourceFilter}
        hideViewToggle={true}
      />
    </div>
  );
};

export default JobResultsGrid; 