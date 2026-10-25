import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRevalidator, useRouteError } from 'react-router';
import { Button } from './Button';

/** Error screen with a Retry and a link back; `messageKey` is an i18n key. */
export function ErrorState({
  messageKey,
  onRetry,
  backTo,
}: {
  messageKey: string;
  onRetry?: (() => void) | undefined;
  backTo: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-3 p-6" role="alert">
      <p>{t(messageKey)}</p>
      <div className="flex items-center gap-3">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
        <Link to={backTo} className="text-accent underline">
          {t('nav.projects')}
        </Link>
      </div>
    </div>
  );
}

/**
 * Route `ErrorBoundary`: a failed loader or a component that threw. Retry revalidates the
 * route, which runs its loader again and re-renders it.
 */
export function RouteError({
  messageKey = 'errors.unexpected',
  backTo = '/projects',
}: {
  messageKey?: string;
  backTo?: string;
}) {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorState messageKey="pages.notFound" backTo={backTo} />;
  }
  if (!isRouteErrorResponse(error)) console.error(error);
  return (
    <ErrorState
      messageKey={messageKey}
      onRetry={() => void revalidator.revalidate()}
      backTo={backTo}
    />
  );
}
