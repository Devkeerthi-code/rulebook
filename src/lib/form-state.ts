/** Result of a form server action, used with useActionState. */
export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
}
