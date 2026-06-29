"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "./ScoreBadge";
import type { CourseListItem } from "@/lib/queries";

interface CourseListProps {
  courses: CourseListItem[];
}

export function CourseList({ courses }: CourseListProps) {
  const [search, setSearch] = useState("");

  const filteredCourses = courses.filter((c) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;

    return (
      c.name.toLowerCase().includes(query) ||
      (c.slug && c.slug.toLowerCase().includes(query)) ||
      (c.level && c.level.toLowerCase().includes(query)) ||
      (c.subject && c.subject.toLowerCase().includes(query)) ||
      (c.batchType && c.batchType.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Bar container */}
      <div className="relative flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full max-w-md group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400 group-focus-within:text-brand transition-colors duration-200"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="text"
            id="course-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by course name, subject, level..."
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-brand focus:ring-2 focus:ring-brand/10 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear search"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Counter Badge */}
        <div className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
          {search ? (
            <span>
              Showing <strong className="text-brand-dark">{filteredCourses.length}</strong> of{" "}
              {courses.length} courses
            </span>
          ) : (
            <span>
              Total: <strong className="text-brand-dark">{courses.length}</strong> courses
            </span>
          )}
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center bg-white shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-sm font-medium text-gray-900">No courses found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No courses match the search query "{search}". Try searching for something else.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setSearch("")}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">Course</th>
                  <th className="px-5 py-3 font-semibold">Level</th>
                  <th className="px-5 py-3 font-semibold">Subject</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/courses/${c.id}`} className="font-semibold text-brand-dark hover:underline">
                        {c.name}
                      </Link>
                      {c.completeness === "partial" && (
                        <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 font-medium">
                          partial
                        </span>
                      )}
                      {c.slug && <div className="text-xs text-gray-400">/{c.slug}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{c.level ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{c.subject ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{c.batchType ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          c.status === "live"
                            ? "bg-green-50 text-green-700 ring-green-600/20"
                            : "bg-gray-50 text-gray-600 ring-gray-500/10"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <ScoreBadge score={c.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
