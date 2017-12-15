import gql from 'graphql-tag';
import { execute, ApolloLink, Observable, FetchResult } from 'apollo-link';
import waitFor from 'wait-for-observables';

import { RetryLink } from '../retryLink';

const query = gql`
  {
    sample {
      id
    }
  }
`;

const standardError = new Error('I never work');

describe('RetryLink', () => {
  it('fails for unreachable endpoints', async () => {
    const max = 10;
    const retry = new RetryLink({ delay: { initial: 1 }, attempts: { max } });
    const stub = jest.fn(() => new Observable(o => o.error(standardError)));
    const link = ApolloLink.from([retry, stub]);

    const [{ error }] = await waitFor(execute(link, { query }));
    expect(error).toEqual(standardError);
    expect(stub).toHaveBeenCalledTimes(max);
  });

  it('returns data from the underlying link on a successful operation', async () => {
    const retry = new RetryLink();
    const data = { data: { hello: 'world' } };
    const stub = jest.fn(() => Observable.of(data));
    const link = ApolloLink.from([retry, stub]);

    const [{ values }] = await waitFor(execute(link, { query }));
    expect(values).toEqual([data]);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('returns data from the underlying link on a successful retry', async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 2 },
    });
    const data = { data: { hello: 'world' } };
    const stub = jest.fn();
    stub.mockReturnValueOnce(new Observable(o => o.error(standardError)));
    stub.mockReturnValueOnce(Observable.of(data));
    const link = ApolloLink.from([retry, stub]);

    const [{ values }] = await waitFor(execute(link, { query }));
    expect(values).toEqual([data]);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('calls unsubscribe on the appropriate downstream observable', async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 2 },
    });
    const data = { data: { hello: 'world' } };
    const unsubscribeStub = jest.fn();

    const firstTry = new Observable(o => o.error(standardError));
    // Hold the test hostage until we're hit
    let secondTry;
    const untilSecondTry = new Promise(resolve => {
      secondTry = {
        subscribe(observer) {
          resolve(); // Release hold on test.

          Promise.resolve().then(() => {
            observer.next(data);
            observer.complete();
          });
          return { unsubscribe: unsubscribeStub };
        },
      };
    });

    const stub = jest.fn();
    stub.mockReturnValueOnce(firstTry);
    stub.mockReturnValueOnce(secondTry);
    const link = ApolloLink.from([retry, stub]);

    const subscription = execute(link, { query }).subscribe({});
    await untilSecondTry;
    subscription.unsubscribe();
    expect(unsubscribeStub).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers to the same request', async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 5 },
    });
    const data = { data: { hello: 'world' } };
    const stub = jest.fn();
    stub.mockReturnValueOnce(new Observable(o => o.error(standardError)));
    stub.mockReturnValueOnce(new Observable(o => o.error(standardError)));
    stub.mockReturnValueOnce(Observable.of(data));
    const link = ApolloLink.from([retry, stub]);

    const observable = execute(link, { query });
    const [result1, result2] = await waitFor(observable, observable);
    expect(result1.values).toEqual([data]);
    expect(result2.values).toEqual([data]);
    expect(stub).toHaveBeenCalledTimes(3);
  });

  it('retries independently for concurrent requests', async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 5 },
    });
    const data = { data: { hello: 'world' } };
    const stub = jest.fn(() => new Observable(o => o.error(standardError)));
    const link = ApolloLink.from([retry, stub]);

    const [result1, result2] = await waitFor(
      execute(link, { query }),
      execute(link, { query }),
    );
    expect(result1.error).toEqual(standardError);
    expect(result2.error).toEqual(standardError);
    expect(stub).toHaveBeenCalledTimes(10);
  });

  it('supports custom delay functions', async () => {
    const delayStub = jest.fn(() => 1);
    const retry = new RetryLink({ delay: delayStub, attempts: { max: 3 } });
    const linkStub = jest.fn(() => new Observable(o => o.error(standardError)));
    const link = ApolloLink.from([retry, linkStub]);
    const [{ error }] = await waitFor(execute(link, { query }));

    expect(error).toEqual(standardError);
    const operation = delayStub.mock.calls[0][1];
    expect(delayStub.mock.calls).toEqual([
      [1, operation, standardError],
      [2, operation, standardError],
    ]);
  });

  it('supports custom attempt functions', async () => {
    const attemptStub = jest.fn();
    attemptStub.mockReturnValueOnce(true);
    attemptStub.mockReturnValueOnce(true);
    attemptStub.mockReturnValueOnce(false);

    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: attemptStub,
    });
    const linkStub = jest.fn(() => new Observable(o => o.error(standardError)));
    const link = ApolloLink.from([retry, linkStub]);
    const [{ error }] = await waitFor(execute(link, { query }));

    expect(error).toEqual(standardError);
    const operation = attemptStub.mock.calls[0][1];
    expect(attemptStub.mock.calls).toEqual([
      [1, operation, standardError],
      [2, operation, standardError],
      [3, operation, standardError],
    ]);
  });
});