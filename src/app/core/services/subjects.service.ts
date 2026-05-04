import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SchoolSubject {
  id: number;
  name: string;
  code?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubject {
  id: number;
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  isMandatory: boolean;
  className: string;
  sectionName: string;
}

export interface TeacherAssignment {
  id: number;
  classSectionSubjectId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail?: string;
  isPrimary: boolean;
  subjectName: string;
  className: string;
  sectionName: string;
}

export interface Teacher {
  id: number;
  name: string;
  email: string;
  qualification?: string;
  experienceYears?: number;
  specialization?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubjectsService {
  private base = 'school/subjects';

  constructor(private api: ApiService) {}

  // ==================== Subject CRUD ====================
  getSubjects(): Observable<{ subjects: SchoolSubject[] }> {
    return this.api.get<{ subjects: SchoolSubject[] }>(this.base);
  }

  createSubject(data: Partial<SchoolSubject>): Observable<{ subject: SchoolSubject }> {
    const payload: any = { name: data.name };
    if (data.code?.trim()) payload.code = data.code.trim();
    if (data.description?.trim()) payload.description = data.description.trim();
    return this.api.post<{ subject: SchoolSubject }>(this.base, payload);
  }
  
  updateSubject(id: number, data: Partial<SchoolSubject>): Observable<{ subject: SchoolSubject }> {
    const payload: any = { name: data.name };
    if (data.code?.trim()) payload.code = data.code.trim();
    if (data.description?.trim()) payload.description = data.description.trim();
    return this.api.put<{ subject: SchoolSubject }>(`${this.base}/${id}`, payload);
  }

  deleteSubject(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/${id}`);
  }

  // ==================== Class-Section Subjects ====================
  getClassSectionSubjects(classSectionId: number): Observable<{ subjects: ClassSubject[] }> {
    return this.api.get<{ subjects: ClassSubject[] }>(
      `${this.base}/class-subjects/${classSectionId}`
    );
  }

  getAllClassSubjects(): Observable<{ classSubjects: ClassSubject[] }> {
    return this.api.get<{ classSubjects: ClassSubject[] }>(`${this.base}/all-class-subjects`);
  }

  getClassSubjectById(
    classSectionSubjectId: number
  ): Observable<{ classSectionSubject: ClassSubject }> {
    return this.api.get<{ classSectionSubject: ClassSubject }>(
      `${this.base}/class-subject/${classSectionSubjectId}`
    );
  }

  assignSubjectToClass(data: {
    classSectionId: number;
    subjectId: number;
    isMandatory?: boolean;
  }): Observable<any> {
    return this.api.post(`${this.base}/assign-class-section`, data);
  }

  unassignSubjectFromClass(classSectionSubjectId: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(
      `${this.base}/unassign-class/${classSectionSubjectId}`
    );
  }

  // ==================== Teacher Assignments ====================
  getTeacherAssignments(teacherId: number): Observable<{ assignments: TeacherAssignment[] }> {
    return this.api.get<{ assignments: TeacherAssignment[] }>(
      `${this.base}/teacher-assignments/${teacherId}`
    );
  }

  assignTeacherToSubject(data: {
    teacherId: number;
    classSectionSubjectId: number;
    isPrimary?: boolean;
  }): Observable<any> {
    return this.api.post(`${this.base}/assign-teacher`, data);
  }

  getClassSubjectTeachers(
    classSectionSubjectId: number
  ): Observable<{ assignments: TeacherAssignment[] }> {
    return this.api.get<{ assignments: TeacherAssignment[] }>(
      `${this.base}/class-subject-teachers/${classSectionSubjectId}`
    );
  }

  unassignTeacherFromSubject(assignmentId: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.base}/unassign-teacher/${assignmentId}`);
  }

  // ==================== Teachers List ====================
  getTeachers(): Observable<{ teachers: Teacher[] }> {
    return this.api.get<{ teachers: Teacher[] }>(`${this.base}/teachers`);
  }
}
