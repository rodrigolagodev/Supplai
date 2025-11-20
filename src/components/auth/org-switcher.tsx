'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  slug: string;
  isAdmin: boolean;
}

interface OrgSwitcherProps {
  currentOrg: Organization;
  organizations: Organization[];
}

export function OrgSwitcher({ currentOrg, organizations }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {currentOrg.isAdmin ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100"
        >
          <div className="text-left">
            <h1 className="text-xl font-semibold text-gray-900">{currentOrg.name}</h1>
            <p className="text-sm text-gray-500">
              {currentOrg.isAdmin ? 'Administrador' : 'Miembro'}
            </p>
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="text-left">
            <h1 className="text-xl font-semibold text-gray-900">{currentOrg.name}</h1>
            <p className="text-sm text-gray-500">Miembro</p>
          </div>
        </div>
      )}

      {isOpen && currentOrg.isAdmin && (
        <div className="absolute left-0 mt-2 w-64 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            {organizations.length > 1 && (
              <>
                <div className="border-b border-gray-100 px-4 py-2">
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Cambiar organización
                  </p>
                </div>

                {organizations.map(org => (
                  <Link
                    key={org.id}
                    href={`/${org.slug}`}
                    className={`block px-4 py-2 text-sm hover:bg-gray-100 ${
                      org.id === currentOrg.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{org.name}</span>
                      {org.id === currentOrg.id && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {org.isAdmin ? 'Administrador' : 'Miembro'}
                    </span>
                  </Link>
                ))}

                <div className="border-t border-gray-100" />
              </>
            )}

            <Link
              href="/onboarding"
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Crear nueva organización
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
