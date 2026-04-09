/**
 * Custom hooks for teacher search functionality
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import searchAPI from './api';
import { toast } from 'react-hot-toast';

/**
 * Main search hook with debouncing, filtering, sorting, pagination
 */
export function useTeacherSearch() {
  const [teachers, setTeachers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search/filter state
  const [searchTopic, setSearchTopic] = useState('');
  const [skip, setSkip] = useState(0);
  const [limit] = useState(10);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(null);
  const [minPrice, setMinPrice] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  // Debounce timeout ref
  const debounceRef = useRef(null);

  // Perform search
  const performSearch = useCallback(
    async (topic, page = 0) => {
      const effectiveTopic = String(topic ?? searchTopic).trim();

      // Backend requires topic query param; avoid 422 by not calling API on empty topic.
      if (!effectiveTopic) {
        setTeachers([]);
        setTotal(0);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const results = await searchAPI.searchTeachers({
          topic: effectiveTopic,
          skip: page * limit,
          limit,
          minRating: minRating > 0 ? minRating : undefined,
          maxPrice,
          minPrice,
          subject: selectedSubject,
          day: selectedDay,
          sortBy: sortBy !== 'relevance' ? sortBy : undefined,
        });

        setTeachers(results.teachers);
        setTotal(results.total);
      } catch (err) {
        console.error('Search failed:', err);
        setError(err.message || 'Failed to search teachers');
        toast.error('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [searchTopic, limit, minRating, maxPrice, minPrice, selectedSubject, selectedDay, sortBy]
  );

  // Debounced search handler
  const handleSearch = useCallback(
    (topic) => {
      setSearchTopic(topic);
      setSkip(0);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        performSearch(topic, 0);
      }, 400);
    },
    [performSearch]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(() => {
    setSkip(0);
    if (!String(searchTopic || '').trim()) {
      setTeachers([]);
      setTotal(0);
      setError(null);
      return;
    }
    performSearch(searchTopic, 0);
  }, [searchTopic, performSearch]);

  // Handle pagination
  const handlePageChange = useCallback(
    (newPage) => {
      if (!String(searchTopic || '').trim()) return;
      setSkip(newPage);
      performSearch(searchTopic, newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchTopic, performSearch]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setMinRating(0);
    setMaxPrice(null);
    setMinPrice(null);
    setSelectedSubject('');
    setSelectedDay('');
    setSortBy('relevance');
    setSearchTopic('');
    setSkip(0);
    setTeachers([]);
    setTotal(0);
  }, []);

  return {
    // Data
    teachers,
    total,
    loading,
    error,
    currentPage: skip,
    pageSize: limit,

    // Search state
    searchTopic,
    minRating,
    maxPrice,
    minPrice,
    selectedSubject,
    selectedDay,
    sortBy,

    // Handlers
    handleSearch,
    setMinRating,
    setMaxPrice,
    setMinPrice,
    setSelectedSubject,
    setSelectedDay,
    setSortBy,
    handleFilterChange,
    handlePageChange,
    clearFilters,
    performSearch,
  };
}

/**
 * Hook for fetching individual teacher details
 */
export function useTeacherDetail(teacherId) {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teacherId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await searchAPI.getTeacherDetail(teacherId);
        setTeacher(data);
      } catch (err) {
        console.error('Failed to fetch teacher detail:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [teacherId]);

  return { teacher, loading, error };
}

/**
 * Hook for fetching available subjects (for filter dropdown)
 */
export function useSubjectsForFilter() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const data = await searchAPI.getSubjects();
        setSubjects(data);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  return { subjects, loading };
}
