import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from 'react-router';
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
      <p className="text-heading">{t(messageKey)}</p>
      <div className="flex items-center gap-3">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
        <Link to={backTo} className="text-accent-text underline underline-offset-2">
          {t('nav.start')}
        </Link>
      </div>
    </div>
  );
}

/**
 * Route `ErrorBoundary`: a component (or a lazy module) that threw. Retry navigates to the
 * same location again, which clears the error and renders the route anew.
 */
export function RouteError({
  messageKey = 'errors.unexpected',
  backTo = '/',
}: {
  messageKey?: string;
  backTo?: string;
}) {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorState messageKey="pages.notFound" backTo={backTo} />;
  }
  if (!isRouteErrorResponse(error)) console.error(error);
  return (
    <ErrorState
      messageKey={messageKey}
      onRetry={() => void navigate(location, { replace: true })}
      backTo={backTo}
    />
  );
}
