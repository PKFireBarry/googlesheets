export interface RowDataObject {
  data?: string[];
  originalIndex?: number;
}

export type RowData = string[] | RowDataObject;

export interface FilteredRow {
  data: string[];
  originalIndex: number;
}

export interface JobData {
  id: string;
  title: string;
  company_name: string;
  location: string;
  job_type?: string;
  salary?: string;
  date_posted?: string;
  description?: string;
  url?: string;
  company_website?: string;
  company_image?: string;
  experience?: string;
  skills?: string;
  notes?: string;
  is_applied: boolean;
  source?: string;
}

export type SalaryType = "any" | "yearly" | "hourly";

export type FilterState = {
  filterText: string;
  selectedLocation: string;
  skillFilter: string;
  showFilters: boolean;
  showLastDayOnly: boolean;
  minSalary: number;
  salaryType: SalaryType;
  excludedWords: string[];
}; 