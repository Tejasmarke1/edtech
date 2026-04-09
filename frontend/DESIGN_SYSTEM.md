# Design System Documentation

## Overview

This document provides a comprehensive guide to the production-level UI/Design System implemented for the Doubt Resolution Platform frontend. All components follow the specification in `FRONTEND_CHANGES_REQUIRED.md` Section 0.

---

## Table of Contents

1. [Design System Foundation](#design-system-foundation)
2. [Component Library](#component-library)
3. [Usage Guide](#usage-guide)
4. [Responsive Design](#responsive-design)
5. [Accessibility](#accessibility)
6. [Best Practices](#best-practices)

---

## Design System Foundation

### Color Palette

#### Brand Colors
- **Primary**: Blue (#0ea5e9) - Primary brand color, CTAs, links
  - Variants: 50-900 (light to dark)

#### Role-Specific Colors
- **Student**: Blue (#0ea5e9) with light variant
- **Teacher**: Green (#16a34a) with light variant

#### Status Colors
- **Success**: #10b981 (Green) - Accepted, completed states
- **Warning**: #f59e0b (Amber) - Pending, warning states
- **Error**: #ef4444 (Red) - Errors, rejected states
- **Info**: #3b82f6 (Blue) - Information alerts

#### Neutral Grays
- Complete gray scale from 50 (lightest) to 900 (darkest)
- Used for text, borders, backgrounds

### Typography

#### Font Families
- **Body**: Inter (400, 500, 600, 700)
- **Headings**: Montserrat (600, 700)

#### Hierarchy
- **Display**: 48px (hero sections)
- **H1**: 32px (main titles)
- **H2**: 24px (section titles)
- **H3**: 18px (card titles)
- **Body Large**: 16px (form labels, prominent text)
- **Body Regular**: 14px (standard paragraphs)
- **Body Small**: 12px (captions, helper text)
- **Button**: 16px semibold

#### Line Heights & Spacing
- **Headings**: 1.2 line height, 0% letter-spacing
- **Body**: 1.6 line height, 0.5% letter-spacing
- **Buttons**: 1.5 line height, 0.5% letter-spacing

### Spacing Scale

All spacing follows a 4px base unit:
```
0.5px (2px), 1px (4px), 2px (8px), 3px (12px), 4px (16px), 5px (20px), 6px (24px), 8px (32px), 10px (40px), 12px (48px), 14px (56px), 16px (64px)
```

### Border Radius

- **Small elements** (buttons, inputs): `rounded-lg` (8px)
- **Medium elements** (cards): `rounded-xl` (12px)
- **Large elements** (containers, hero): `rounded-2xl` (16px)
- **Pill-shaped**: `rounded-full`

### Shadows (Elevation System)

- **shadow-sm**: Subtle (4px offset, 10% opacity) - Hovered cards, tooltips
- **shadow-md**: Default (8px offset, 15% opacity) - Cards at rest, modals
- **shadow-lg**: Elevated (16px offset, 20% opacity) - Modal stacked, dropdowns
- **shadow-xl**: Maximum (25px offset, 25% opacity) - Hero modals, notifications
- **Color-specific**: Blue shadow for primary, amber for warnings

### Dark Mode

- All components support `dark:` variants via Tailwind
- Uses `prefers-color-scheme: dark` and CSS class-based toggling
- All colors meet WCAG AA contrast in both light and dark modes

---

## Component Library

### Form Components

#### Button

```jsx
import { Button } from '@/components/ui';

// Variants: 'primary', 'secondary', 'outline', 'danger', 'success', 'ghost', 'ghost-primary'
// Sizes: 'xs', 'sm', 'md' (default), 'lg', 'xl'

<Button variant="primary" size="md">
  Click Me
</Button>

<Button variant="danger" loading={true}>
  Deleting...
</Button>

<Button variant="ghost" icon={EditIcon} iconOnly />
```

**States**: Default, Hover, Active/Pressed, Disabled, Loading

---

#### Input

```jsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  placeholder="Enter your email"
  error={errors.email}
  required
/>

<Input
  label="Message"
  type="textarea"
  maxLength={500}
  showCharCount={true}
  helper="Required for contact"
/>

<Input
  type="password"
  label="Password"
  success="Password strength: Strong"
  icon={LockIcon}
/>
```

**States**: Default, Focus, Hover, Disabled, Error, Success, Loading

---

#### Select

```jsx
import { Select } from '@/components/ui';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
];

<Select
  label="Choose Subject"
  options={options}
  value={selected}
  onChange={setSelected}
  error={errors.subject}
  disabled={isLoading}
/>
```

**Features**: Custom styled, keyboard navigation, touch-friendly, animated chevron

---

#### Checkbox & CheckboxGroup

```jsx
import { Checkbox, CheckboxGroup } from '@/components/ui';

// Single checkbox
<Checkbox
  id="agree"
  label="I agree to terms"
  checked={agreed}
  onChange={() => setAgreed(!agreed)}
/>

// Group
<CheckboxGroup
  label="Select topics"
  options={[
    { value: 'math', label: 'Math' },
    { value: 'science', label: 'Science' },
  ]}
  value={selected}
  onChange={setSelected}
  error={errors.topics}
/>
```

**Features**: 24×24px hit area, customized styling, animated checkmark, focus ring

---

#### Radio & RadioGroup

```jsx
import { Radio, RadioGroup } from '@/components/ui';

// Group (recommended)
<RadioGroup
  name="role"
  label="Select Role"
  options={[
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
  ]}
  value={selected}
  onChange={setSelected}
  error={errors.role}
/>
```

**Features**: Animated dot, custom styling, focus ring, touch-friendly

---

### Display Components

#### Card

```jsx
import { Card, CardHeader, CardBody, CardFooter, CardImage } from '@/components/ui';

// Simple card
<Card>
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>

// Structured card with variants
<Card variant="elevated" interactive={true}>
  <CardImage src="/image.jpg" alt="Hero" />
  <CardHeader>Title with border</CardHeader>
  <CardBody>Main content here</CardBody>
  <CardFooter>
    <Button variant="ghost">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

**Variants**: `default`, `elevated`, `outlined`, `gradient`, `interactive`

**Features**: Hover elevation, smooth transitions, flexible sectioning

---

#### Badge

```jsx
import { Badge, BadgeGroup } from '@/components/ui';

<Badge variant="solid" status="accepted">
  Accepted
</Badge>

<Badge variant="soft" color="warning">
  Pending
</Badge>

// Status badges
<Badge status="pending">Pending</Badge>
<Badge status="accepted">Accepted</Badge>
<Badge status="completed">Completed</Badge>
<Badge status="rejected">Rejected</Badge>
<Badge status="proposed">Proposed</Badge>
```

**Variants**: `solid`, `outlined`, `soft`

**Colors**: `primary`, `success`, `warning`, `error`, `gray`

**Sizes**: `xs`, `sm`, `md`

---

#### Avatar

```jsx
import { Avatar, AvatarGroup } from '@/components/ui';

<Avatar
  name="John Doe"
  src="/avatar.jpg"
  size="md"
  status="online"
  clickable={true}
/>

// Fallback to initials
<Avatar initials="JD" size="lg" />

// Group of avatars
<AvatarGroup
  avatars={[
    { name: 'John Doe' },
    { name: 'Jane Smith' },
  ]}
  max={3}
  size="md"
/>
```

**Sizes**: `xs`, `sm`, `md`, `lg`, `xl`

**Status**: `online`, `offline`, `away`, `busy` (shows indicator dot)

---

#### Tabs

```jsx
import { Tabs } from '@/components/ui';

const tabs = [
  { label: 'Overview', content: <OverviewPanel /> },
  { label: 'Details', content: <DetailsPanel /> },
  { label: 'Reviews', content: <ReviewsPanel /> },
];

<Tabs
  tabs={tabs}
  defaultTabIndex={0}
  onTabChange={(index) => console.log('Tab:', index)}
/>
```

**Features**: Smooth fade-in/out, keyboard navigation, responsive scrolling

---

#### Pagination

```jsx
import { Pagination, AdvancedPagination } from '@/components/ui';

// Basic
<Pagination
  currentPage={1}
  totalPages={20}
  onPageChange={setPage}
/>

// Advanced with info
<AdvancedPagination
  currentPage={1}
  totalPages={20}
  onPageChange={setPage}
  totalItems={200}
  perPage={10}
/>
```

**Features**: Previous/Next with disabled states, page numbers, "Go to page" input

---

### Feedback Components

#### Loading States

```jsx
import {
  Skeleton,
  CardSkeleton,
  ListSkeleton,
  Spinner,
  ProgressBar,
  LoadingOverlay,
} from '@/components/ui';

// Skeleton loaders
<Skeleton variant="text" />
<CardSkeleton />
<ListSkeleton count={5} />

// Spinners
<Spinner size="md" variant="primary" />

// Progress bar
<ProgressBar progress={65} showLabel={true} />

// Full screen overlay
<LoadingOverlay isVisible={isLoading} message="Loading..." />
```

**Skeleton Variants**: `text`, `circle`, `rect`, `avatar`, `card`

---

#### Toast Notifications

```jsx
import {
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
} from '@/components/ui';

showSuccessToast('Session booked successfully!');
showErrorToast('Failed to save changes');
showWarningToast('Session is about to start');
showInfoToast('New teacher available');
```

**Auto-dismiss**: Success/Info 3-4s, Error/Warning 5-6s

**Features**: Position: bottom-right, stackable, manual close always available

---

#### Modal/Dialog

```jsx
import { Modal, ConfirmationDialog, AlertDialog } from '@/components/ui';

// Basic modal
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Session Details"
  footer={
    <>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </>
  }
>
  <p>Modal content here</p>
</Modal>

// Confirmation dialog
<ConfirmationDialog
  isOpen={showConfirm}
  title="Delete Session?"
  message="This will cancel the session permanently"
  confirmText="Delete"
  confirmVariant="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
/>

// Alert dialog
<AlertDialog
  isOpen={showAlert}
  type="success"
  title="Session Completed"
  message="Great work! Your session is now complete."
  actionText="Done"
  onClose={() => setShowAlert(false)}
/>
```

**Features**: Animations (fade-in + zoom), responsive sizing, backdrop click, Escape key to close

**Sizes**: `sm`, `md`, `lg`, `xl`, `full`

---

## Usage Guide

### Importing Components

```jsx
// Individual imports
import { Button, Input, Card } from '@/components/ui';

// Or specific import
import Button from '@/components/ui/Button';
```

### Common Patterns

#### Form with Validation

```jsx
import { Button, Input, Select } from '@/components/ui';
import { useForm } from 'react-hook-form';

export function BookingForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Full Name"
        placeholder="John Doe"
        {...register('name', { required: 'Name is required' })}
        error={errors.name?.message}
      />
      <Select
        label="Subject"
        options={subjects}
        {...register('subject', { required: 'Subject is required' })}
        error={errors.subject?.message}
      />
      <Button variant="primary" type="submit">
        Book Session
      </Button>
    </form>
  );
}
```

#### Loading State

```jsx
import { ShowLoadingOverlay, CardSkeleton } from '@/components/ui';

export function TeachersList() {
  const { data: teachers, isLoading } = useTeachers();

  if (isLoading) {
    return (
      <>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </>
    );
  }

  return teachers.map(teacher => (
    <Card key={teacher.id}>
      {/* ... */}
    </Card>
  ));
}
```

#### Status Display

```jsx
import { Badge } from '@/components/ui';

export function SessionStatus({ status }) {
  return (
    <Badge status={status}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
```

---

## Responsive Design

### Breakpoints

- **Mobile** (default): < 640px
- **Tablet** (`md`): 640px–1024px
- **Desktop** (`lg`): 1024px–1280px
- **Large Desktop** (`xl`): > 1280px

### Responsive Utilities

```jsx
// Tailwind responsive classes
<div className="text-body md:text-body-lg lg:text-h3">
  Responsive text size
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  Responsive grid
</div>

<div className="p-4 md:p-6 lg:p-8">
  Responsive padding
</div>
```

### Mobile-First Approach

Always start with mobile styles and add larger breakpoint styles/modifiers:

```jsx
<Button size="sm" className="md:size-md lg:size-lg">
  Responsive Button
</Button>
```

---

## Accessibility

### Color Contrast

- All color combinations meet WCAG AA standard (4.5:1 minimum)
- Verified in light and dark modes
- Use axe DevTools to verify

### Keyboard Navigation

- All interactive elements focusable via Tab
- Focus outline visible (ring-2 ring-primary-500)
- Escape key closes modals
- Arrow keys navigate selects, tabs

### Screen Reader Support

- Semantic HTML (`<button>`, `<input>`, etc.)
- ARIA labels where needed
- Role attributes for custom components
- `aria-current` for active states
- `aria-busy` for loading states

### Example

```jsx
<Button
  aria-label="Delete session"
  aria-busy={isDeleting}
  disabled={isDeleting}
>
  Delete
</Button>
```

---

## Best Practices

### 1. Consistent Sizing

Always use predefined sizes from the design system:

```jsx
// ✅ Good
<Button size="md" />
<Input size="md" />

// ❌ Avoid
<Button className="px-5 py-2.5" />
```

### 2. Color Usage

Use semantic color names:

```jsx
// ✅ Good
<Badge status="accepted" />
<Button variant="danger" />

// ❌ Avoid
<Badge className="bg-green-500" />
```

### 3. Spacing

Use Tailwind spacing scale:

```jsx
// ✅ Good
<div className="p-4 gap-3 mb-6">
// ❌ Avoid
<div className="p-5 gap-2.5 mb-7">
```

### 4. Typography

Use predefined classes:

```jsx
// ✅ Good
<h1 className="text-h1">Title</h1>
<p className="text-body">Paragraph</p>

// ❌ Avoid
<h1 className="text-4xl font-bold">Title</h1>
```

### 5. Loading and Error States

Always show appropriate feedback:

```jsx
// Show skeleton or spinner while loading
if (isLoading) return <CardSkeleton />;

// Show error state with retry
if (error) return <ErrorCard onRetry={refetch} />;

// Success state
return <SuccessCard />;
```

### 6. Responsive Images

Always optimize and provide alt text:

```jsx
<img
  src="/teacher.jpg"
  alt="Teacher name - profile picture"
  loading="lazy"
  className="w-full h-48 object-cover"
/>
```

---

## Theme Toggle (Optional Dark Mode)

```jsx
// In your App.jsx or layout
import { useEffect, useState } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(
    localStorage.getItem('theme') === 'dark'
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(!isDark) };
}
```

---

## Performance Optimization

### Code Splitting

```jsx
// Lazy load heavy components
const Modal = lazy(() => import('@/components/modals/Modal'));

// Use with Suspense
<Suspense fallback={<Spinner />}>
  <Modal isOpen={true} />
</Suspense>
```

### Memoization

```jsx
// Memoize expensive components
const TeacherCard = memo(({ teacher }) => (
  <Card>{/* ... */}</Card>
), (prev, next) => prev.teacher.id === next.teacher.id);
```

### Image Optimization

- Use WebP format with fallback
- Lazy loading for below-the-fold images
- Responsive images with `srcset`

---

## Support & Feedback

For design system questions or improvements, refer to:
- [FRONTEND_CHANGES_REQUIRED.md](../FRONTEND_CHANGES_REQUIRED.md) - Detailed requirements
- [Figma Design](link-to-figma) - Design specifications (if available)
- Team Design Channel - For discussions

---

**Last Updated**: April 2026
**Version**: 1.0
