import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, Button, Input, Badge, Spinner } from '../../components/ui';
import TeacherCard from '../../components/cards/TeacherCard';
import { useTeacherSearch, useSubjectsForFilter } from '../../features/search/hooks';
import apiClient from '../../api/client';
import { toast } from 'react-hot-toast';

/**
 * Find Teachers page with search, filters, sorting, and pagination
 * Students can discover, filter, and book teachers
 */
export default function FindTeachers() {
  const navigate = useNavigate();
  const {
    teachers,
    total,
    loading,
    error,
    currentPage,
    pageSize,
    searchTopic,
    minRating,
    maxPrice,
    minPrice,
    selectedSubject,
    selectedDay,
    sortBy,
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
  } = useTeacherSearch();

  const { subjects } = useSubjectsForFilter();
  const [showFilters, setShowFilters] = useState(true);
  const [discoveryMode, setDiscoveryMode] = useState('teacher_match');
  const [openClasses, setOpenClasses] = useState([]);
  const [loadingOpenClasses, setLoadingOpenClasses] = useState(false);
  const [openClassesError, setOpenClassesError] = useState('');
  const [enrollingSessionId, setEnrollingSessionId] = useState(null);
  const [openClassSearch, setOpenClassSearch] = useState('');
  const [openClassDate, setOpenClassDate] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'rating', label: 'Rating (High to Low)' },
    { value: 'price_low', label: 'Price (Low to High)' },
    { value: 'price_high', label: 'Price (High to Low)' },
    { value: 'newest', label: 'Newest First' },
  ];

  const hasActiveFilters = useMemo(() => {
    return minRating > 0 || maxPrice || minPrice || selectedSubject || selectedDay || sortBy !== 'relevance';
  }, [minRating, maxPrice, minPrice, selectedSubject, selectedDay, sortBy]);

  const totalPages = Math.ceil(total / pageSize);
  const quickTopics = ['Algebra', 'Physics', 'Chemistry', 'Calculus', 'IELTS'];

  const loadOpenClasses = async (subjectId = '') => {
    setLoadingOpenClasses(true);
    setOpenClassesError('');
    try {
      const { data } = await apiClient.get('/sessions/group/available', {
        params: {
          skip: 0,
          limit: 50,
          ...(subjectId ? { subject_id: subjectId } : {}),
        },
      });
      setOpenClasses(data.items || []);
    } catch (err) {
      console.error('Failed to load open classes:', err);
      setOpenClassesError(err?.response?.data?.detail || 'Failed to load open classes');
    } finally {
      setLoadingOpenClasses(false);
    }
  };

  const handleEnrollOpenClass = async (sessionId) => {
    setEnrollingSessionId(sessionId);
    try {
      await apiClient.post(`/sessions/${sessionId}/enroll`);
      toast.success('Enrolled successfully! Check My Sessions for updates.');
      await loadOpenClasses(selectedSubject);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Unable to enroll right now');
    } finally {
      setEnrollingSessionId(null);
    }
  };

  const handleApplyFilters = () => {
    handleFilterChange();
  };

  const filteredOpenClasses = useMemo(() => {
    const term = openClassSearch.trim().toLowerCase();
    return openClasses.filter((session) => {
      const matchesText =
        !term ||
        String(session.subject_name || '').toLowerCase().includes(term) ||
        String(session.topic_description || '').toLowerCase().includes(term) ||
        String(session.teacher_name || session.teacher_id || '').toLowerCase().includes(term);

      const matchesDate = !openClassDate || String(session.session_date) === openClassDate;
      return matchesText && matchesDate;
    });
  }, [openClasses, openClassSearch, openClassDate]);

  const handleSwitchMode = async (mode) => {
    setDiscoveryMode(mode);
    if (mode === 'open_class') {
      await loadOpenClasses(selectedSubject);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">Find Learning Options</h2>
        <p className="text-lg text-slate-700">Choose how you want to learn: request 1:1 help, or join teacher-led open classes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={discoveryMode === 'teacher_match' ? 'primary' : 'outline'}
            onClick={() => handleSwitchMode('teacher_match')}
          >
            1:1 Teacher Match
          </Button>
          <Button
            variant={discoveryMode === 'open_class' ? 'primary' : 'outline'}
            onClick={() => handleSwitchMode('open_class')}
          >
            Open Group Classes
          </Button>
          <Button variant="outline" onClick={() => navigate('/my-sessions')}>
            My Enrollments
          </Button>
        </div>
      </div>

      {discoveryMode === 'open_class' ? (
        <div className="space-y-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardBody className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="w-full md:max-w-sm">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Filter by subject</label>
                  <select
                    value={selectedSubject}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setSelectedSubject(value);
                      await loadOpenClasses(value);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map(subject => (
                      <option key={subject.sub_id} value={subject.sub_id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:max-w-sm">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Search class</label>
                  <input
                    type="text"
                    value={openClassSearch}
                    onChange={(e) => setOpenClassSearch(e.target.value)}
                    placeholder="Subject, topic, or teacher"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="w-full md:max-w-xs">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Class date</label>
                  <input
                    type="date"
                    value={openClassDate}
                    onChange={(e) => setOpenClassDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <Button variant="outline" onClick={() => loadOpenClasses(selectedSubject)}>
                  Refresh Classes
                </Button>
              </div>
            </CardBody>
          </Card>

          {loadingOpenClasses && (
            <div className="flex justify-center py-12"><Spinner /></div>
          )}

          {openClassesError && !loadingOpenClasses && (
            <Card className="bg-red-50 border-2 border-red-200 shadow-sm">
              <CardBody className="text-center py-8">
                <p className="text-red-800 font-medium mb-2">Unable to load open classes</p>
                <p className="text-red-700 text-base mb-4">{openClassesError}</p>
                <Button onClick={() => loadOpenClasses(selectedSubject)}>Try Again</Button>
              </CardBody>
            </Card>
          )}

          {!loadingOpenClasses && !openClassesError && filteredOpenClasses.length === 0 && (
            <Card className="bg-slate-50 border-2 border-slate-200 shadow-sm">
              <CardBody className="text-center py-12">
                <p className="text-slate-900 text-2xl font-bold mb-2">No open classes right now</p>
                <p className="text-slate-600 text-base">Check back later or switch to 1:1 teacher matching.</p>
              </CardBody>
            </Card>
          )}

          {!loadingOpenClasses && !openClassesError && filteredOpenClasses.length > 0 && (
            <div className="space-y-4">
              {filteredOpenClasses.map((session) => (
                <Card key={session.id} className="border border-slate-200 shadow-sm">
                  <CardBody>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Open Class</p>
                        <h3 className="text-xl font-bold text-slate-900">{session.subject_name || 'General Session'}</h3>
                        <p className="text-slate-700">{session.topic_description || 'Topic details will be shared by the teacher.'}</p>
                        <p className="text-sm text-slate-600">
                          Teacher: {session.teacher_name || session.teacher_id} • Date: {new Date(session.session_date).toLocaleDateString()} • Time: {session.slot_start_time && session.slot_end_time ? `${session.slot_start_time} - ${session.slot_end_time}` : 'TBD'} • Seats Left: {session.seats_left ?? 'N/A'} / {session.max_students || 'N/A'}
                        </p>
                        <p className="text-sm font-semibold text-slate-800">
                          Group Price: {Number.isFinite(Number(session.group_per_student_charges)) ? `Rs. ${Number(session.group_per_student_charges)} per student` : 'Not published yet'}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <Badge variant="soft" color="blue">{session.status}</Badge>
                        {typeof session.seats_left === 'number' && session.seats_left <= 3 && (
                          <Badge variant="soft" color="amber">Only {session.seats_left} seats left</Badge>
                        )}
                        <Button
                          onClick={() => handleEnrollOpenClass(session.id)}
                          loading={enrollingSessionId === session.id}
                          disabled={
                            session.is_enrolled ||
                            (typeof session.seats_left === 'number' && session.seats_left <= 0)
                          }
                        >
                          {session.is_enrolled
                            ? 'Already Joined'
                            : (typeof session.seats_left === 'number' && session.seats_left <= 0 ? 'Class Full' : 'Join This Class')}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Filters Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className={`sticky top-20 border border-slate-200 shadow-sm ${!showFilters && 'hidden lg:block'}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Filters</h3>
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Subject Filter */}
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-3">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(subject => (
                    <option key={subject.sub_id} value={subject.sub_id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-3">Minimum Rating</label>
                <div className="space-y-2.5">
                  {[
                    { value: 0, label: 'All Ratings' },
                    { value: 3, label: '3+ Stars' },
                    { value: 4, label: '4+ Stars' },
                    { value: 4.5, label: '4.5+ Stars' },
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="rating"
                        value={option.value}
                        checked={minRating === option.value}
                        onChange={(e) => {
                          setMinRating(parseFloat(e.target.value));
                          handleFilterChange();
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-base text-slate-800">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-3">Price Range</label>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Min Price (Rs.)</label>
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      size="lg"
                      value={minPrice || ''}
                      onChange={(e) => setMinPrice(e.target.value ? parseFloat(e.target.value) : null)}
                      onBlur={handleFilterChange}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Max Price (Rs.)</label>
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      size="lg"
                      value={maxPrice || ''}
                      onChange={(e) => setMaxPrice(e.target.value ? parseFloat(e.target.value) : null)}
                      onBlur={handleFilterChange}
                      placeholder="Any"
                    />
                  </div>
                </div>
              </div>

              {/* Availability Filter */}
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-3">Available Day</label>
                <select
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Any Day</option>
                  {days.map(day => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-3">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    handleFilterChange();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Apply Filters Button (Mobile) */}
              <Button
                onClick={handleApplyFilters}
                className="w-full lg:hidden"
              >
                Apply Filters
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 xl:col-span-9">
          {/* Search Bar */}
          <Card className="mb-6 border border-slate-200 shadow-sm">
            <CardBody>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search by topic (e.g., 'algebra', 'trigonometry')..."
                  size="lg"
                  value={searchTopic}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  Filters
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Popular:</span>
                {quickTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => handleSearch(topic)}
                    className="px-3 py-1.5 text-sm rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Results Info & Active Filters */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium text-slate-800">
                {total > 0
                  ? `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, total)} of ${total} teachers`
                  : searchTopic
                  ? 'No teachers found'
                  : 'Enter a topic to search'}
              </p>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {minRating > 0 && (
                  <Badge variant="soft" color="blue">
                    {minRating}+ Stars
                  </Badge>
                )}
                {minPrice && (
                  <Badge variant="soft" color="green">
                    Min Rs. {minPrice}
                  </Badge>
                )}
                {maxPrice && (
                  <Badge variant="soft" color="green">
                    Max Rs. {maxPrice}
                  </Badge>
                )}
                {selectedSubject && (
                  <Badge variant="soft" color="purple">
                    Subject: {subjects.find(s => s.sub_id === selectedSubject)?.name}
                  </Badge>
                )}
                {selectedDay && (
                  <Badge variant="soft" color="indigo">
                    {selectedDay}
                  </Badge>
                )}
                {sortBy !== 'relevance' && (
                  <Badge variant="soft" color="slate">
                    {sortOptions.find(s => s.value === sortBy)?.label}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="bg-red-50 border-2 border-red-200 shadow-sm">
              <CardBody className="text-center py-8">
                <p className="text-red-800 font-medium mb-4">Search Error</p>
                <p className="text-red-700 text-base mb-4">{error}</p>
                <Button
                  onClick={() => handleSearch(searchTopic)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Try Again
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && total === 0 && searchTopic && (
            <Card className="bg-amber-50 border-2 border-amber-200 shadow-sm">
              <CardBody className="text-center py-12">
                <p className="text-amber-900 font-semibold text-2xl mb-2">No teachers found</p>
                <p className="text-amber-800 text-base mb-4">
                  Try searching with different keywords or adjusting your filters.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Empty Search State */}
          {!loading && !error && total === 0 && !searchTopic && (
            <Card className="bg-slate-50 border-2 border-slate-200 shadow-sm">
              <CardBody className="text-center py-12">
                <p className="text-slate-900 text-2xl font-bold mb-2">Start your search</p>
                <p className="text-slate-600 text-base">
                  Enter a topic or subject name above to find qualified teachers
                </p>
              </CardBody>
            </Card>
          )}

          {/* Teacher Cards Grid */}
          {!loading && !error && teachers.length > 0 && (
            <div className="space-y-4 mb-8">
              {teachers.map(teacher => (
                <TeacherCard
                  key={teacher.user_name || teacher.id || teacher.user_id}
                  teacher={teacher}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && teachers.length > 0 && totalPages > 1 && (
            <div className="flex justify-center gap-4 items-center mt-8">
              <Button
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3.5 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                {totalPages > 5 && <span className="text-slate-500">...</span>}
              </div>

              <Button
                variant="outline"
                disabled={currentPage >= totalPages - 1}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
