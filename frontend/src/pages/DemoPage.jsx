import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

export default function DemoPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">UI Design System Demo</h1>
        <p className="text-slate-500 mt-2">Testing our reusable components before building actual pages.</p>
      </div>

      <div className="space-y-12">
        {/* Buttons Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-2">Buttons</h2>
          <div className="flex flex-wrap gap-4 items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </section>

        {/* Inputs Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-2">Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <Input 
              label="Standard Input" 
              placeholder="Type something here..." 
            />
            <Input 
              label="With Value" 
              defaultValue="John Doe" 
            />
            <Input 
              label="Password Input" 
              type="password" 
              defaultValue="password123" 
            />
            <Input 
              label="Error State" 
              placeholder="Invalid input" 
              defaultValue="wrong-email"
              error="Please enter a valid email address." 
            />
          </div>
        </section>

        {/* Cards Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-2">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Standard Card</h3>
              <p className="text-slate-600 mb-6">A basic card component with padding, rounded corners, and a soft shadow. Ideal for static content.</p>
              <div className="flex justify-end">
                <Button variant="ghost">Learn More</Button>
              </div>
            </Card>

            <Card hoverable className="cursor-pointer">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Hoverable Card</h3>
                  <p className="text-sm text-slate-500">Interactive element</p>
                </div>
              </div>
              <p className="text-slate-600">This card elevates slightly and increases its shadow when hovered, perfect for clickable lists or grids.</p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
