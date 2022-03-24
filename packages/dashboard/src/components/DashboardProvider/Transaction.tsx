import { useState, useEffect } from "react";
import ReactJson from "react-json-view";
const inspect = require("browser-util-inspect");
import * as Codec from "@truffle/codec";
import type { ProjectDecoder } from "@truffle/decoder";

interface Props {
  transaction: any;
  decoder: ProjectDecoder | undefined;

}


export default function Transaction({
  transaction,
  decoder
}: Props) {
  const [decoding, setDecoding] = useState<Codec.CalldataDecoding | undefined>();

  useEffect(() => {
    if (!decoder) {
      return;
    }

    decoder.decodeTransaction({
      blockNumber: null,
      to: transaction.to || null,
      from: transaction.from,
      input: transaction.data,
      value: transaction.value
    })
      .then(setDecoding);
  }, [transaction, decoder]);


  console.debug("decoding %o", decoding);
  if (decoding) {
    console.log(inspect(new Codec.Export.CalldataDecodingInspector(decoding)));
  }

  const decodedTransaction = decoding && (
    <pre>
    {inspect(new Codec.Export.CalldataDecodingInspector(decoding))}
    </pre>
  );


  return (
    <div>
      {decodedTransaction}
      <ReactJson name="transaction" src={transaction} />
    </div>
  );

}
