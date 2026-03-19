export interface EmployeeDto {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds: string[];
}

export interface CreateEmployeeDto {
  name: string;
  serviceIds?: string[];
}

export interface UpdateEmployeeDto {
  name?: string;
  serviceIds?: string[];
  isActive?: boolean;
}
