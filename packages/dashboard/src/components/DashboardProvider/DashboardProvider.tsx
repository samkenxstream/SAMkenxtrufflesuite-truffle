import WebSocket from "isomorphic-ws";
import { useEffect } from "react";
import { useWeb3React } from "@web3-react/core";
import { providers } from "ethers";
import type { WorkflowCompileResult } from "@truffle/compile-common";
import {
  handleDashboardProviderRequest,
  isInteractiveRequest,
  isUnsupportedRequest,
  respondToUnsupportedRequest
} from "../../utils/utils";
import Card from "../common/Card";
import IncomingRequest from "./IncomingRequest";
import type { DashboardProviderMessage } from "@truffle/dashboard-message-bus";
import { useDecoder, DecoderContext } from "../../decoding";

interface Props {
  paused: boolean;
  requests: DashboardProviderMessage[];
  setRequests: (
    requests:
      | DashboardProviderMessage[]
      | ((requests: DashboardProviderMessage[]) => DashboardProviderMessage[])
  ) => void;
  socket: WebSocket;
  workflowCompileResult: WorkflowCompileResult | undefined;
}

function DashboardProvider({
  paused,
  socket,
  requests,
  setRequests,
  workflowCompileResult
}: Props) {
  const { account, library } = useWeb3React<providers.Web3Provider>();

  useEffect(() => {
    const removeFromRequests = (id: number) => {
      setRequests(previousRequests =>
        previousRequests.filter(request => request.id !== id)
      );
    };

    if (!account || !library) return;
    if (paused) return;

    // Automatically respond with an error for unsupported requests
    requests.filter(isUnsupportedRequest).forEach(request => {
      respondToUnsupportedRequest(request, socket);
      removeFromRequests(request.id);
    });

    // Automatically handle all non-interactive requests
    requests
      .filter(
        request =>
          !isInteractiveRequest(request) && !isUnsupportedRequest(request)
      )
      .forEach(request => {
        handleDashboardProviderRequest(request, library.provider, socket);
        removeFromRequests(request.id);
      });
  }, [paused, requests, setRequests, socket, account, library]);

  const decoder = useDecoder({
    workflowCompileResult,
    provider: library?.provider
  });

  const incomingRequests =
    account && library && socket
      ? requests
          .filter(isInteractiveRequest)
          .map(request => (
            <IncomingRequest
              request={request}
              setRequests={setRequests}
              provider={library.provider}
              socket={socket}
            />
          ))
      : [];

  return (
    <div className="flex justify-center items-center py-20">
      <div className="mx-3 w-3/4 max-w-4xl h-2/3">
        <DecoderContext.Provider value={decoder}>
          <Card header="Incoming Requests" body={incomingRequests} />
        </DecoderContext.Provider>
      </div>
    </div>
  );
}

export default DashboardProvider;
