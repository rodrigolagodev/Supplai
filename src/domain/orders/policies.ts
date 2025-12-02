import type { Order, OrderItem } from '@/domain/types';
import type { Database } from '@/types/database';

/**
 * OrderPolicies - Business rules and authorization for orders
 *
 * These are pure functions that encapsulate domain rules.
 * They don't modify state - they only answer questions about what actions are allowed.
 *
 * Benefits:
 * - Testable without infrastructure
 * - Clear expression of business rules
 * - Single source of truth for authorization logic
 */

export interface User {
  id: string;
  role?: Database['public']['Enums']['membership_role'];
}

/**
 * Check if a user can edit an order
 *
 * Rules:
 * - Order must not be in 'sent' or 'archived' status
 * - User must be the creator OR an admin
 */
export function canEditOrder(order: Order, user: User): boolean {
  // Sent and archived orders cannot be edited
  if (order.status === 'sent' || order.status === 'archived') {
    return false;
  }

  // Creator can always edit (if not sent/archived)
  if (order.created_by === user.id) {
    return true;
  }

  // Admins can edit any order in their organization
  if (user.role === 'admin') {
    return true;
  }

  return false;
}

/**
 * Check if a user can view an order
 *
 * Rules:
 * - Any member of the organization can view
 * - (Organization membership is checked at a higher layer)
 */
export function canViewOrder(_order: Order, _user: User): boolean {
  // If the user has access to the organization, they can view
  // Organization membership check happens in auth layer
  return true;
}

/**
 * Check if a user can delete an order
 *
 * Rules:
 * - Only drafts can be deleted
 * - User must be the creator OR an admin
 */
export function canDeleteOrder(order: Order, user: User): boolean {
  // Only drafts can be deleted
  if (order.status !== 'draft') {
    return false;
  }

  // Creator can delete their own draft
  if (order.created_by === user.id) {
    return true;
  }

  // Admins can delete any draft
  if (user.role === 'admin') {
    return true;
  }

  return false;
}

/**
 * Check if an order can be submitted/sent
 *
 * Rules:
 * - Must be in 'review' status
 * - Must have at least one item
 */
export function canSubmitOrder(order: Order, items: OrderItem[]): boolean {
  // Must be in review status
  if (order.status !== 'review') {
    return false;
  }

  // Must have items
  if (items.length === 0) {
    return false;
  }

  return true;
}

/**
 * Check if an order can be processed (parsed with AI)
 *
 * Rules:
 * - Must be in 'draft' status (not already processed)
 */
export function canProcessOrder(order: Order): boolean {
  return order.status === 'draft';
}

/**
 * Check if an item can be edited
 *
 * Rules:
 * - Parent order must be editable
 */
export function canEditItem(order: Order, user: User): boolean {
  return canEditOrder(order, user);
}

/**
 * Calculate if an order is ready for review
 *
 * This is a business rule that determines when an order transitions
 * from 'draft' to 'review' automatically.
 */
export function isReadyForReview(order: Order, items: OrderItem[]): boolean {
  // Must have items
  if (items.length === 0) {
    return false;
  }

  // All items should have reasonable confidence
  const lowConfidenceItems = items.filter(
    item => item.confidence_score !== null && item.confidence_score < 0.5
  );

  // If more than 50% of items have low confidence, not ready
  if (lowConfidenceItems.length > items.length / 2) {
    return false;
  }

  return true;
}

/**
 * Check if an item needs supplier assignment
 */
export function needsSupplierAssignment(item: OrderItem): boolean {
  return item.supplier_id === null;
}

/**
 * Calculate order completeness score (0-100)
 *
 * This can be used for UI progress indicators
 */
export function calculateOrderCompleteness(order: Order, items: OrderItem[]): number {
  if (items.length === 0) return 0;

  let score = 0;

  // Base score for having items
  score += 30;

  // Score for supplier assignment
  const itemsWithSupplier = items.filter(item => item.supplier_id !== null).length;
  score += (itemsWithSupplier / items.length) * 40;

  // Score for confidence
  const avgConfidence =
    items.reduce((sum, item) => sum + (item.confidence_score || 0), 0) / items.length;
  score += avgConfidence * 30;

  return Math.round(score);
}
